import { requireRole } from "@/lib/auth";
import { listRepoDirectories } from "@/lib/gitea-submit";
import { getLectureRepoFolder, getLectureTexFileName } from "@/lib/lecture-repo-path";
import { prisma } from "@/lib/prisma";
import { assignTaskAction } from "@/app/admin/actions";
import AdminSectionNav from "@/components/admin-section-nav";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";
import SubmitButton from "@/components/submit-button";

type PageProps = {
  searchParams?: {
    lectureId?: string;
    teacherId?: string;
    success?: string;
    error?: string;
  };
};

export default async function AdminTaskAssignPage({ searchParams }: PageProps) {
  await requireRole("admin");

  const [lectures, teachers, tasks, repoFolders] = await Promise.all([
    prisma.lecture.findMany({
      where: {
        status: "TODO",
        tasks: {
          none: {},
        },
      },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        templatePath: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: "TEACHER",
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        name: true,
      },
    }),
    prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        lecture: {
          select: {
            code: true,
            title: true,
            status: true,
            templatePath: true,
          },
        },
        assignee: {
          select: {
            name: true,
            username: true,
          },
        },
      },
    }),
    listRepoDirectories().catch(() => [""]),
  ]);

  const canAssign = lectures.length > 0 && teachers.length > 0;
  const selectedLecture =
    lectures.find((lecture) => lecture.id === searchParams?.lectureId) ?? lectures[0] ?? null;
  const defaultRepoFolder = selectedLecture ? getLectureRepoFolder(selectedLecture.templatePath) : "";
  const defaultTexFileName = selectedLecture ? getLectureTexFileName(selectedLecture.templatePath) : "";

  return (
    <PageContainer
      title="任务分配"
      wide
      hideHeader
    >
      <div className="page-header">
        <AdminSectionNav />
      </div>

      {searchParams?.success ? (
        <div className="feedback-banner success">任务已分配，初始草稿也已生成。</div>
      ) : null}
      {searchParams?.error ? (
        <div className="feedback-banner error">
          {searchParams.error === "assigned"
            ? "该讲义已分配任务，不能重复分配。"
            : searchParams.error === "exists"
              ? "仓库中已存在同名 .tex 文件，请更换文件夹或文件名。"
              : searchParams.error === "missing"
                ? "请选择讲义和老师，并填写讲义文件名后再提交。"
                : searchParams.error}
        </div>
      ) : null}

      {!canAssign ? (
        <EmptyState
          title="暂时无法分配任务"
          description="请先准备至少一条未分配讲义和一个老师账号。"
        />
      ) : (
        <section className="form-card">
          <form action={assignTaskAction} className="admin-form-grid">
            <label className="form-field">
              <span>选择讲义</span>
              <select name="lectureId" defaultValue={searchParams?.lectureId ?? ""}>
                <option value="">请选择讲义</option>
                {lectures.map((lecture) => (
                  <option key={lecture.id} value={lecture.id}>
                    {lecture.code} / {lecture.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>选择老师</span>
              <select name="teacherId" defaultValue={searchParams?.teacherId ?? ""}>
                <option value="">请选择老师</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.username}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>仓库文件夹</span>
              <input
                name="repoFolder"
                type="text"
                list="repoFolderOptions"
                defaultValue={defaultRepoFolder}
                placeholder="留空=仓库根目录；也可直接输入新文件夹名"
              />
              <datalist id="repoFolderOptions">
                {repoFolders
                  .filter((folder) => folder)
                  .map((folder) => (
                    <option key={folder} value={folder} />
                  ))}
              </datalist>
            </label>

            <label className="form-field">
              <span>讲义文件名</span>
              <input
                name="texFileName"
                type="text"
                defaultValue={defaultTexFileName}
                placeholder="例如：test1.tex"
              />
            </label>

            <div className="form-actions form-field-full">
              <SubmitButton
                idleText="创建并分配任务"
                pendingText="分配中..."
                className="primary-button"
              />
            </div>
          </form>
        </section>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          title="暂无任务记录"
          description="分配第一条任务后，这里会展示最近任务。"
        />
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>任务标题</th>
                <th>讲义</th>
                <th>仓库文件</th>
                <th>老师</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>
                    {task.lecture.code} / {task.lecture.title}
                  </td>
                  <td>{task.lecture.templatePath}</td>
                  <td>
                    {task.assignee.username}
                  </td>
                  <td>{task.lecture.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
