export type LatexDiagnostic = {
  line: number;
  message: string;
  severity: "error" | "warning";
};

const FILE_LINE_ERROR = /^[^:]*\.tex:(\d+):\s*(.+)$/;
const LATEX_WARNING = /LaTeX Warning:\s*(.+?)\s+on input line (\d+)\./;

/**
 * 从 xelatex 编译日志中提取可定位到行号的错误与警告。
 * 依赖编译时启用的 -file-line-error 选项(形如 `main.tex:42: 错误信息`)。
 */
export function parseLatexLog(log: string): LatexDiagnostic[] {
  const diagnostics: LatexDiagnostic[] = [];
  const seen = new Set<string>();

  for (const raw of log.split(/\r?\n/)) {
    const line = raw.trim();

    const errorMatch = line.match(FILE_LINE_ERROR);
    if (errorMatch) {
      const lineNo = Number(errorMatch[1]);
      const message = errorMatch[2].trim();
      const key = `e:${lineNo}:${message}`;

      if (lineNo > 0 && message && !seen.has(key)) {
        seen.add(key);
        diagnostics.push({ line: lineNo, message, severity: "error" });
      }

      continue;
    }

    const warningMatch = line.match(LATEX_WARNING);
    if (warningMatch) {
      const lineNo = Number(warningMatch[2]);
      const message = warningMatch[1].trim();
      const key = `w:${lineNo}:${message}`;

      if (lineNo > 0 && message && !seen.has(key)) {
        seen.add(key);
        diagnostics.push({ line: lineNo, message, severity: "warning" });
      }
    }
  }

  return diagnostics;
}
