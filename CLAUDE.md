# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

讲义管理系统 —— 管理员创建讲次并把 LaTeX 撰写任务分配给老师;老师在浏览器内的 CodeMirror 编辑器中编辑 `.tex` 源码、用 `xelatex` 编译成 PDF 并提交审核;管理员查看 git 差异后合并进 Gitea 仓库。

界面文案与提交信息均使用中文。

## 协作方式

本项目采用「分工协作」模式:

- **用户负责运行与反馈**:用户在 Sealos DevBox(集群内环境)里运行系统 —— 启动服务、连接数据库、实际操作页面,然后把使用中发现的问题或需求反馈回来。`.env` 中的 `DATABASE_URL` 指向集群内部域名(`*.ns-xxx.svc`),只能在 DevBox 内连通,本地无法启动完整系统。
- **Claude 负责写代码**:根据用户反馈修改代码。**每完成一项修改后必须 `git commit`**,提交信息用中文、简明描述本次改动。
- 本地这份 clone 用于阅读和修改代码;不要尝试在本地启动服务或连数据库。

## 常用命令

```bash
bash entrypoint.sh              # 开发服务器(pnpm run dev,端口 3000)
bash entrypoint.sh production   # 构建 + 启动生产服务

pnpm run lint                   # next lint / eslint

pnpm run prisma:generate        # 修改 schema.prisma 后重新生成 Prisma client
pnpm run prisma:migrate         # 创建并应用一次开发迁移
pnpm run prisma:seed            # 写入默认管理员/老师及演示数据(prisma/seed.js)
```

`pnpm` 是约定的包管理器(`entrypoint.sh` 使用它),尽管仓库里同时提交了 `package-lock.json` 和 `yarn.lock`。项目没有配置测试套件或测试运行器。

## 必需的环境变量

写在 `.env`(已被 gitignore)。缺失时应用会在运行时抛错:

- `DATABASE_URL` —— PostgreSQL 连接串(Prisma)。
- `AUTH_SECRET` —— 会话 cookie 的 HMAC 密钥;同时用作内部 API 的共享密钥。
- `GITEA_BASE_URL`、`GITEA_OWNER`、`GITEA_REPO`、`GITEA_BOT_USERNAME`、`GITEA_BOT_TOKEN`,可选 `GITEA_DEFAULT_BRANCH`(默认 `main`)—— 讲义仓库。
- `MINIO_ENDPOINT`、`MINIO_BUCKET`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`,可选 `MINIO_USE_SSL` —— 存放上传素材与编译 PDF 的 S3 兼容存储。
- `SYSTEM_SETTINGS_PASSWORD` —— 用于进入 `/system-settings`(默认 `admin`)。

编译依赖宿主机上的 `xelatex`(`texlive-xetex` 等);若缺失,`compileLatexTask` 会优雅降级并输出安装指引日志。

## 架构

Next.js 14 App Router(TypeScript、React 18)。路径别名 `@/*` → `src/*`。写操作通过各目录下 `actions.ts` 中的 Server Action 实现,而非 REST 路由。

### 任务生命周期(核心领域模型)

`prisma/schema.prisma` 中的 `TaskStatus` 枚举是驱动整个系统的状态机:

`ASSIGNED` → `IN_PROGRESS`(老师保存草稿)→ `SUBMITTED`(已推送到 Gitea 分支)→ `CHANGES_REQUESTED`(管理员驳回)或 `MERGED`(管理员通过并合并 PR)。

流程:管理员先创建 **Lecture**(讲次),再分配一个 **Task**,该任务携带一份 **TaskDraft**(`.tex` 源码)以及唯一的 `branchName` 和仓库文件路径。老师编辑草稿、上传图片 **Asset**(→ MinIO)、编译、提交。提交时会把草稿与素材推送到一个 Gitea 分支(`lib/gitea-submit.ts`)并写入一条 **Submission** 记录。管理员审阅分支与主分支的差异,选择要求修改或通过 Gitea PR API 合并。**ReviewRecord** 是所有提交/审核动作的只追加审计轨迹。

注意:`Lecture.templatePath` 一词多义 —— 它存的是该讲次在仓库内的*目标 `.tex` 路径*(例如 `chapter1/main.tex`),并非模板文件。仓库路径的安全校验统一走 `lib/lecture-repo-path.ts`。

### 鉴权(自研,无第三方库)

会话是 HMAC-SHA256 签名的 cookie(`auth_session`),不是 JWT。**签名/解码逻辑实现了两份**:

- `src/lib/auth.ts` —— 服务端,使用 `node:crypto`。提供页面和 Server Action 用到的 `requireRole("admin"|"teacher")`。
- `middleware.ts` —— 运行在 Edge runtime,因此*无法*引入 `node:crypto`,改用 Web Crypto 重新实现了同样的解码。**当会话格式变更时,这两份必须保持同步。**

`middleware.ts` 守护 `/admin/*` 与 `/teacher/*`,按角色重定向;对于老师的任务路由,它会调用 `/api/internal/task-access/[taskId]`(用 `AUTH_SECRET` 共享密钥认证)校验任务归属。服务端页面还会通过 `lib/teacher-task.ts` 中的 `getOwnedTeacherTask` 再次校验归属 —— 这两层都要保留,不要只依赖 middleware。

`User.passwordPlain` 在 scrypt `passwordHash` 之外,以明文存储密码(以便管理员在界面查看老师的登录凭据)。

### 主要目录

- `src/app/admin/*` —— 讲次增删改查、老师管理、任务分配、审核队列。
- `src/app/teacher/*` —— 任务列表、任务详情、`/edit` CodeMirror 工作区。
- `src/lib/` —— 集成边界:`gitea-submit.ts`(在临时 clone 中调用 `git` + Gitea REST API)、`latex.ts`(在临时目录中运行两遍 `xelatex`)、`minio.ts`(S3 客户端)、`prisma.ts`(单例 client)。
- `src/components/teacher-editor-workspace.tsx` —— LaTeX 编辑器(CodeMirror 6 + `codemirror-lang-latex`)。

### 老师端编辑器(Overleaf 风格)

`teacher-editor-workspace.tsx` 是一个 CodeMirror 6 客户端组件,编辑/编译循环走 JSON API 而非 Server Action,以实现「不刷新整页、不丢光标」的原地编译:

- `PUT /api/teacher/tasks/[taskId]/draft` —— 自动保存(停止输入约 1.5s 后)与 `Ctrl/⌘+S`,仅存草稿、标记待重新编译,**保留**上一次成功的 PDF。
- `POST /api/teacher/tasks/[taskId]/compile` —— 「重新编译」按钮与 `Ctrl/⌘+Enter`,保存草稿 + xelatex 编译,返回状态/日志/可定位错误(`diagnostics`),前端原地刷新右侧 PDF iframe(靠 `?v=` 版本号防缓存)。
- 编译日志经 `lib/latex-log.ts` 解析成带行号的错误/警告,在编辑器内用 lint 标记,并在「编译问题」面板里可点击跳转。
- 因此 `GET .../pdf` 路由允许在「待重新编译」状态下仍返回上一次成功的 PDF —— `lastPdfPath` 永远指向最近一次成功产物。

### 约定

- Server Action 完成写操作后,先对所有受影响的路由调用 `revalidatePath`,再 `redirect` 并带上 `success`/`error` 查询参数,页面读取这些参数渲染提示条。
- 例外:老师端编辑器的保存/编译用上面的 JSON API 路由,不走 Server Action(需要原地更新、不整页跳转)。
- `gitea-submit.ts` 每次操作都 clone 到独立的系统临时目录,并始终在 `finally` 中清理;git 凭据通过生成的 `GIT_ASKPASS` 脚本传入,错误信息在抛出前会清除其中的 bot token。
