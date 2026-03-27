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
  assets: Array<{
    filePath: string;
  }>;
};

async function prepareCompileDirectory(input: CompileTaskInput) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), `latex-task-${input.taskId}-`));
  const mainTexPath = path.join(tempRoot, "main.tex");
  await writeFile(mainTexPath, input.texSource, "utf8");

  for (const asset of input.assets) {
    const localAssetPath = path.join(tempRoot, asset.filePath);
    await mkdir(path.dirname(localAssetPath), { recursive: true });
    const downloaded = await downloadFromMinio(asset.filePath);
    await writeFile(localAssetPath, downloaded.body);
  }

  return {
    tempRoot,
    mainTexPath,
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

  const { tempRoot } = await prepareCompileDirectory(input);

  try {
    let output = "";

    for (let run = 0; run < 2; run += 1) {
      const result = await execFileAsync(
        "xelatex",
        ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "main.tex"],
        {
          cwd: tempRoot,
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      output += `${result.stdout}\n${result.stderr}\n`;
    }

    const generatedPdfPath = path.join(tempRoot, "main.pdf");
    await access(generatedPdfPath);
    const pdfBuffer = await readFile(generatedPdfPath);
    const pdfKey = `compiled-pdfs/${input.taskId}/${Date.now()}-main.pdf`;

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
