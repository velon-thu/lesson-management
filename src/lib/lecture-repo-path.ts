import path from "node:path";

function normalizeRelativePath(input: string) {
  const normalized = path.posix.normalize(input.trim());

  if (!normalized || normalized === "." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new Error("仓库路径不合法。");
  }

  return normalized;
}

export function normalizeRepoFolder(input: string) {
  const raw = input.trim();

  if (!raw || raw === ".") {
    return "";
  }

  const normalized = path.posix.normalize(raw);

  if (normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(normalized)) {
    throw new Error("仓库文件夹不合法。");
  }

  return normalized === "." ? "" : normalized.replace(/\/$/, "");
}

export function normalizeTexFileName(input: string) {
  const fileName = input.trim();

  if (!fileName) {
    throw new Error("请填写讲义文件名。");
  }

  if (fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("讲义文件名不能包含路径分隔符。");
  }

  if (!fileName.endsWith(".tex")) {
    throw new Error("讲义文件名必须以 .tex 结尾。");
  }

  return fileName;
}

export function buildLectureRepoFilePath(repoFolder: string, texFileName: string) {
  const safeFolder = normalizeRepoFolder(repoFolder);
  const safeFileName = normalizeTexFileName(texFileName);

  return safeFolder ? path.posix.join(safeFolder, safeFileName) : safeFileName;
}

export function normalizeLectureRepoFilePath(input: string) {
  const normalized = normalizeRelativePath(input);

  if (!normalized.endsWith(".tex")) {
    throw new Error("讲义文件路径必须以 .tex 结尾。");
  }

  return normalized;
}

export function getLectureRepoFolder(input: string) {
  const normalized = normalizeLectureRepoFilePath(input);
  const folder = path.posix.dirname(normalized);
  return folder === "." ? "" : folder;
}

export function getLectureTexFileName(input: string) {
  return path.posix.basename(normalizeLectureRepoFilePath(input));
}
