import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { downloadFromMinio } from "@/lib/minio";
import { normalizeLectureRepoFilePath } from "@/lib/lecture-repo-path";

type TaskAssetInput = {
  filePath: string;
};

type SubmitTaskToRepoInput = {
  taskId: string;
  lectureCode: string;
  repoFilePath: string;
  branchName: string;
  texSource: string;
  assets: TaskAssetInput[];
};

type SubmitTaskToRepoResult = {
  branchName: string;
  commitSha: string;
  contentPath: string;
};

type ReviewDiffResult = {
  diffText: string;
  branchTexSource: string;
  mainBranchTexSource: string;
};

type GiteaConfig = {
  baseUrl: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  botUsername: string;
  botToken: string;
  botEmail: string;
};

function getGiteaConfig(): GiteaConfig {
  const baseUrl = process.env.GITEA_BASE_URL?.trim();
  const owner = process.env.GITEA_OWNER?.trim();
  const repo = process.env.GITEA_REPO?.trim();
  const defaultBranch = process.env.GITEA_DEFAULT_BRANCH?.trim() || "main";
  const botUsername = process.env.GITEA_BOT_USERNAME?.trim();
  const botToken = process.env.GITEA_BOT_TOKEN?.trim();

  if (!baseUrl || !owner || !repo || !botUsername || !botToken) {
    throw new Error(
      "缺少 Gitea 配置，请检查 GITEA_BASE_URL、GITEA_OWNER、GITEA_REPO、GITEA_BOT_USERNAME、GITEA_BOT_TOKEN。"
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    owner,
    repo,
    defaultBranch,
    botUsername,
    botToken,
    botEmail: `${botUsername}@noreply.local`,
  };
}

function sanitizeGitMessage(message: string, config: GiteaConfig) {
  return message
    .replaceAll(config.botToken, "[REDACTED_TOKEN]")
    .replaceAll(`${config.botUsername}:`, `${config.botUsername}:`)
    .replaceAll(`${config.baseUrl}/${config.owner}/${config.repo}.git`, `${config.owner}/${config.repo}.git`);
}

function validateRelativePath(inputPath: string, label: string) {
  const normalized = path.posix.normalize(inputPath);

  if (normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(normalized)) {
    throw new Error(`${label} 路径不合法：${inputPath}`);
  }

  return normalized;
}

function runGit(
  args: string[],
  options: {
    cwd?: string;
    env: NodeJS.ProcessEnv;
  }
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error((stderr || stdout || `git exited with code ${code}`).trim()));
    });
  });
}

async function createGitAskPassScript(tempRoot: string) {
  const askPassPath = path.join(tempRoot, "git-askpass.sh");
  const script = `#!/bin/sh
case "$1" in
  *sername*) echo "$GITEA_BOT_USERNAME" ;;
  *assword*) echo "$GITEA_BOT_TOKEN" ;;
  *) echo "" ;;
esac
`;
  await writeFile(askPassPath, script, { mode: 0o700 });
  return askPassPath;
}

async function createGitRuntime() {
  const config = getGiteaConfig();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "gitea-task-"));
  const repoDir = path.join(tempRoot, "repo");
  const askPassPath = await createGitAskPassScript(tempRoot);
  const gitEnv: NodeJS.ProcessEnv = {
    ...process.env,
    GITEA_BOT_USERNAME: config.botUsername,
    GITEA_BOT_TOKEN: config.botToken,
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: askPassPath,
  };

  return {
    config,
    repoUrl: `${config.baseUrl}/${config.owner}/${config.repo}.git`,
    tempRoot,
    repoDir,
    gitEnv,
  };
}

async function cloneDefaultBranch(runtime: Awaited<ReturnType<typeof createGitRuntime>>) {
  await runGit(
    ["clone", "--depth", "1", "--branch", runtime.config.defaultBranch, runtime.repoUrl, runtime.repoDir],
    {
      env: runtime.gitEnv,
    }
  );

  await runGit(["config", "user.name", runtime.config.botUsername], {
    cwd: runtime.repoDir,
    env: runtime.gitEnv,
  });
  await runGit(["config", "user.email", runtime.config.botEmail], {
    cwd: runtime.repoDir,
    env: runtime.gitEnv,
  });
}

async function remoteBranchExists(repoUrl: string, branchName: string, env: NodeJS.ProcessEnv) {
  const output = await runGit(["ls-remote", "--heads", repoUrl, branchName], { env });
  return output.trim().length > 0;
}

export async function listRepoDirectories() {
  const runtime = await createGitRuntime();

  try {
    await cloneDefaultBranch(runtime);

    const output = await runGit(
      ["ls-tree", "-d", "-r", "--name-only", `origin/${runtime.config.defaultBranch}`],
      {
        cwd: runtime.repoDir,
        env: runtime.gitEnv,
      }
    );

    const directories = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line !== ".git")
      .sort((a, b) => a.localeCompare(b, "zh-CN"));

    return ["", ...directories];
  } finally {
    await rm(runtime.tempRoot, { recursive: true, force: true });
  }
}

export async function repoFileExistsInDefaultBranch(repoFilePath: string) {
  const runtime = await createGitRuntime();
  const normalizedPath = normalizeLectureRepoFilePath(repoFilePath);

  try {
    await cloneDefaultBranch(runtime);

    try {
      await runGit(["cat-file", "-e", `origin/${runtime.config.defaultBranch}:${normalizedPath}`], {
        cwd: runtime.repoDir,
        env: runtime.gitEnv,
      });
      return true;
    } catch {
      return false;
    }
  } finally {
    await rm(runtime.tempRoot, { recursive: true, force: true });
  }
}

async function writeTaskFilesToRepo(params: {
  repoDir: string;
  taskId: string;
  repoFilePath: string;
  texSource: string;
  assets: TaskAssetInput[];
}) {
  const normalizedRepoFilePath = normalizeLectureRepoFilePath(params.repoFilePath);
  const localTargetPath = path.join(params.repoDir, normalizedRepoFilePath);
  const localTargetDir = path.dirname(localTargetPath);
  const taskAssetsRoot = path.join(localTargetDir, "assets", params.taskId);

  await rm(taskAssetsRoot, { recursive: true, force: true });
  await mkdir(localTargetDir, { recursive: true });
  await writeFile(localTargetPath, params.texSource, "utf8");

  for (const asset of params.assets) {
    const relativeAssetPath = validateRelativePath(asset.filePath, "素材");

    if (!relativeAssetPath.startsWith("assets/")) {
      throw new Error(`素材路径不符合预期：${asset.filePath}`);
    }

    const downloaded = await downloadFromMinio(asset.filePath);
    const localAssetPath = path.join(localTargetDir, relativeAssetPath);
    await mkdir(path.dirname(localAssetPath), { recursive: true });
    await writeFile(localAssetPath, downloaded.body);
  }

  return normalizedRepoFilePath;
}

export async function submitTaskToGiteaRepo(
  input: SubmitTaskToRepoInput
): Promise<SubmitTaskToRepoResult> {
  const branchName = input.branchName.trim() || `task/${input.taskId}`;
  const runtime = await createGitRuntime();

  try {
    await cloneDefaultBranch(runtime);

    const branchExists = await remoteBranchExists(runtime.repoUrl, branchName, runtime.gitEnv);

    if (branchExists) {
      await runGit(["fetch", "origin", branchName], {
        cwd: runtime.repoDir,
        env: runtime.gitEnv,
      });
      await runGit(["checkout", "-B", branchName, "FETCH_HEAD"], {
        cwd: runtime.repoDir,
        env: runtime.gitEnv,
      });
    } else {
      await runGit(["checkout", "-b", branchName, `origin/${runtime.config.defaultBranch}`], {
        cwd: runtime.repoDir,
        env: runtime.gitEnv,
      });
    }

    const contentPath = await writeTaskFilesToRepo({
      repoDir: runtime.repoDir,
      taskId: input.taskId,
      repoFilePath: input.repoFilePath,
      texSource: input.texSource,
      assets: input.assets,
    });

    await runGit(["add", "-A", "--", "."], {
      cwd: runtime.repoDir,
      env: runtime.gitEnv,
    });

    await runGit(
      [
        "commit",
        "--allow-empty",
        "-m",
        `Submit task ${input.taskId} for lecture ${input.lectureCode}`,
      ],
      {
        cwd: runtime.repoDir,
        env: runtime.gitEnv,
      }
    );

    await runGit(["push", "-u", "origin", branchName], {
      cwd: runtime.repoDir,
      env: runtime.gitEnv,
    });

    const commitSha = await runGit(["rev-parse", "HEAD"], {
      cwd: runtime.repoDir,
      env: runtime.gitEnv,
    });

    return {
      branchName,
      commitSha: commitSha.trim(),
      contentPath,
    };
  } catch (error) {
    const message =
      error instanceof Error ? sanitizeGitMessage(error.message, runtime.config) : "Gitea 提交失败";
    throw new Error(message);
  } finally {
    await rm(runtime.tempRoot, { recursive: true, force: true });
  }
}

export async function getTaskMainTexDiff(params: {
  repoFilePath: string;
  branchName: string;
}): Promise<ReviewDiffResult> {
  const runtime = await createGitRuntime();
  const repoFilePath = normalizeLectureRepoFilePath(params.repoFilePath);
  const reviewRef = "refs/remotes/origin/__review_branch";

  try {
    await cloneDefaultBranch(runtime);
    await runGit(["fetch", "origin", `${params.branchName}:${reviewRef}`], {
      cwd: runtime.repoDir,
      env: runtime.gitEnv,
    });

    const diffText =
      (await runGit(
        [
          "diff",
          `origin/${runtime.config.defaultBranch}...origin/__review_branch`,
          "--",
          repoFilePath,
        ],
        {
          cwd: runtime.repoDir,
          env: runtime.gitEnv,
        }
      )) || "当前讲义文件与主分支相比没有差异。";

    const mainBranchTexSource = await runGit(
      ["show", `origin/${runtime.config.defaultBranch}:${repoFilePath}`],
      {
        cwd: runtime.repoDir,
        env: runtime.gitEnv,
      }
    ).catch(() => "主分支中暂无该讲义文件。");

    const branchTexSource = await runGit(["show", `origin/${params.branchName}:${repoFilePath}`], {
      cwd: runtime.repoDir,
      env: runtime.gitEnv,
    }).catch(async () => {
      return runGit(["show", `origin/__review_branch:${repoFilePath}`], {
        cwd: runtime.repoDir,
        env: runtime.gitEnv,
      }).catch(() => "当前任务分支中暂无该讲义文件。");
    });

    return {
      diffText,
      branchTexSource,
      mainBranchTexSource,
    };
  } catch (error) {
    const message =
      error instanceof Error ? sanitizeGitMessage(error.message, runtime.config) : "获取源码差异失败";
    throw new Error(message);
  } finally {
    await rm(runtime.tempRoot, { recursive: true, force: true });
  }
}

export async function mergeTaskBranchToMain(params: {
  branchName: string;
  taskId: string;
}): Promise<{ mergeCommitSha: string }> {
  const config = getGiteaConfig();
  const apiBase = `${config.baseUrl}/api/v1/repos/${config.owner}/${config.repo}`;

  async function requestJson<T>(url: string, init?: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `token ${config.botToken}`,
        ...(init?.headers ?? {}),
      },
    });

    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : null;

    return { response, data, text };
  }

  try {
    const branchCheck = await requestJson<{ name: string }>(
      `${apiBase}/branches/${encodeURIComponent(params.branchName)}`
    );

    if (branchCheck.response.status !== 200) {
      throw new Error(`未找到任务分支：${params.branchName}`);
    }

    let pullNumber: number | null = null;

    const createPull = await requestJson<{ number: number; mergeable?: boolean; message?: string }>(
      `${apiBase}/pulls`,
      {
        method: "POST",
        body: JSON.stringify({
          title: `Merge ${params.branchName} for task ${params.taskId}`,
          head: params.branchName,
          base: config.defaultBranch,
          body: "Auto-created by admin review merge flow.",
        }),
      }
    );

    if (createPull.response.status === 201 && createPull.data) {
      pullNumber = createPull.data.number;
    } else {
      const pullsResponse = await requestJson<
        Array<{
          number: number;
          head: { ref: string };
          base: { ref: string };
          merged: boolean;
          state: string;
        }>
      >(`${apiBase}/pulls?state=open`);

      if (pullsResponse.response.status !== 200 || !pullsResponse.data) {
        throw new Error("创建审核合并请求失败。");
      }

      const existingPull = pullsResponse.data.find(
        (pull) =>
          pull.head.ref === params.branchName &&
          pull.base.ref === config.defaultBranch &&
          !pull.merged &&
          pull.state === "open"
      );

      if (!existingPull) {
        throw new Error(
          createPull.data && "message" in createPull.data && createPull.data.message
            ? String(createPull.data.message)
            : "创建审核合并请求失败。"
        );
      }

      pullNumber = existingPull.number;
    }

    const mergeResult = await requestJson<{ sha?: string; message?: string }>(
      `${apiBase}/pulls/${pullNumber}/merge`,
      {
        method: "POST",
        body: JSON.stringify({
          Do: "merge",
          merge_message_field: `Merge ${params.branchName} for task ${params.taskId}`,
        }),
      }
    );

    if (mergeResult.response.status !== 200) {
      throw new Error(
        mergeResult.data && "message" in mergeResult.data && mergeResult.data.message
          ? String(mergeResult.data.message)
          : mergeResult.text || "合并任务分支失败"
      );
    }

    const mergedPull = await requestJson<{ merge_commit_sha?: string }>(
      `${apiBase}/pulls/${pullNumber}`
    );

    const mergeCommitSha = mergedPull.data?.merge_commit_sha;

    if (!mergeCommitSha) {
      throw new Error("合并已执行，但未获取到 merge commit SHA。");
    }

    return { mergeCommitSha: mergeCommitSha.trim() };
  } catch (error) {
    const message = error instanceof Error ? sanitizeGitMessage(error.message, config) : "合并分支失败";
    throw new Error(message);
  }
}
