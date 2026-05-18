import { mkdtemp, mkdir, rm, writeFile, access, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { downloadFromMinio, uploadToMinio } from "@/lib/minio";

const execFileAsync = promisify(execFile);

export const COMPILE_STATUS = {
  success: "SUCCESS",
  failed: "FAILED",
  pending: "PENDING_RECOMPILE",
} as const;

export async function hasXelatex() {
  try {
    await execFileAsync("xelatex", ["--version"], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

type CompileTaskInput = {
  taskId: string;
  texSource: string;
  entryFilePath: string;
  assets: Array<{
    filePath: string;
  }>;
};

async function prepareCompileDirectory(input: CompileTaskInput) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), `latex-task-${input.taskId}-`));
  const entryFilePath = path.join(tempRoot, input.entryFilePath);
  const entryDir = path.dirname(entryFilePath);
  await mkdir(entryDir, { recursive: true });
  await writeFile(entryFilePath, input.texSource, "utf8");

  for (const asset of input.assets) {
    const localAssetPath = path.join(entryDir, asset.filePath);
    await mkdir(path.dirname(localAssetPath), { recursive: true });
    const downloaded = await downloadFromMinio(asset.filePath);
    await writeFile(localAssetPath, downloaded.body);
  }

  return {
    tempRoot,
    entryFilePath,
  };
}

function buildMissingXelatexLog() {
  return [
    "编译失败：系统中未检测到 xelatex。",
    "请先在 DevBox 终端安装 LaTeX 依赖：",
    "sudo apt-get update",
    "sudo apt-get install -y texlive-xetex texlive-lang-chinese texlive-latex-extra",
  ].join("\n");
}

export async function compileLatexTask(input: CompileTaskInput) {
  const xelatexReady = await hasXelatex();

  if (!xelatexReady) {
    return {
      ok: false,
      status: COMPILE_STATUS.failed,
      log: buildMissingXelatexLog(),
      pdfPath: null,
    };
  }

  const { tempRoot, entryFilePath } = await prepareCompileDirectory(input);
  const compileCwd = path.dirname(entryFilePath);
  const entryFileName = path.basename(entryFilePath);
  const pdfFileName = `${path.parse(entryFileName).name}.pdf`;

  try {
    let output = "";

    for (let run = 0; run < 2; run += 1) {
      const result = await execFileAsync(
        "xelatex",
        ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", entryFileName],
        {
          cwd: compileCwd,
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      output += `${result.stdout}\n${result.stderr}\n`;
    }

    const generatedPdfPath = path.join(compileCwd, pdfFileName);
    await access(generatedPdfPath);
    const pdfBuffer = await readFile(generatedPdfPath);
    const pdfKey = `compiled-pdfs/${input.taskId}/${Date.now()}-${pdfFileName}`;

    await uploadToMinio({
      key: pdfKey,
      body: pdfBuffer,
      contentType: "application/pdf",
    });

    return {
      ok: true,
      status: COMPILE_STATUS.success,
      log: output.trim() || "编译成功。",
      pdfPath: pdfKey,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? [error.message, "stdout" in error ? String(error.stdout ?? "") : "", "stderr" in error ? String(error.stderr ?? "") : ""]
            .filter(Boolean)
            .join("\n")
        : "未知编译错误";

    return {
      ok: false,
      status: COMPILE_STATUS.failed,
      log: message,
      pdfPath: null,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

/**
 * 在一个已经准备好的目录中直接用 xelatex 编译，返回 PDF 内容（Buffer）。
 * 与 compileLatexTask 不同：不下载素材、不上传 MinIO，由调用方自行准备工作目录
 * （组合下载、修改已完成讲义都在 Gitea 仓库克隆目录中编译，素材就在原位）。
 */
export async function compileLatexInDirectory(params: {
  cwd: string;
  entryFileName: string;
}): Promise<{ ok: boolean; log: string; pdf: Buffer | null }> {
  if (!(await hasXelatex())) {
    return { ok: false, log: buildMissingXelatexLog(), pdf: null };
  }

  const pdfFileName = `${path.parse(params.entryFileName).name}.pdf`;

  try {
    let output = "";

    for (let run = 0; run < 2; run += 1) {
      const result = await execFileAsync(
        "xelatex",
        ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", params.entryFileName],
        {
          cwd: params.cwd,
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      output += `${result.stdout}\n${result.stderr}\n`;
    }

    const generatedPdfPath = path.join(params.cwd, pdfFileName);
    await access(generatedPdfPath);
    const pdf = await readFile(generatedPdfPath);

    return { ok: true, log: output.trim() || "编译成功。", pdf };
  } catch (error) {
    const message =
      error instanceof Error
        ? [error.message, "stdout" in error ? String(error.stdout ?? "") : "", "stderr" in error ? String(error.stderr ?? "") : ""]
            .filter(Boolean)
            .join("\n")
        : "未知编译错误";

    return { ok: false, log: message, pdf: null };
  }
}
