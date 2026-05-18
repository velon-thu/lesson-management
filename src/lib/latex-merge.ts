type MergeItem = {
  title: string;
  source: string;
  graphicsDir?: string;
};

const BEGIN_DOC = "\\begin{document}";
const END_DOC = "\\end{document}";

const DEFAULT_PREAMBLE = "\\documentclass{article}\n\\usepackage[UTF8]{ctex}";

/** 把一份完整的 LaTeX 源码拆成「导言区」和「正文」。无 document 环境时整体视作正文。 */
function splitDocument(source: string): { preamble: string; body: string } {
  const beginIdx = source.indexOf(BEGIN_DOC);
  const endIdx = source.lastIndexOf(END_DOC);

  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    return { preamble: "", body: source.trim() };
  }

  return {
    preamble: source.slice(0, beginIdx).trimEnd(),
    body: source.slice(beginIdx + BEGIN_DOC.length, endIdx).trim(),
  };
}

/**
 * 把多份已完成讲义合并成一份可编译的 LaTeX 文档：
 * 取第一份的导言区，正文依次拼接并以 \clearpage 分页。
 * 每份正文中的 \maketitle 会被移除，避免重复打印标题。
 */
export function mergeLatexSources(items: MergeItem[]): string {
  if (items.length === 0) {
    throw new Error("请至少选择一份讲义。");
  }

  const basePreamble = splitDocument(items[0].source).preamble || DEFAULT_PREAMBLE;
  const needsGraphicx = !/\\usepackage(\[[^\]]*\])?\{[^}]*graphicx[^}]*\}/.test(basePreamble);

  const graphicsDirs = Array.from(
    new Set(items.map((item) => (item.graphicsDir ?? "").trim()))
  );
  const graphicsPath = `\\graphicspath{${graphicsDirs
    .map((dir) => `{${dir ? `${dir}/` : "./"}}`)
    .join("")}}`;

  const bodies = items.map((item) => {
    const body = splitDocument(item.source).body.replace(/\\maketitle/g, "").trim();
    return `% ===== ${item.title} =====\n${body}`;
  });

  const lines = [basePreamble];

  if (needsGraphicx) {
    lines.push("\\usepackage{graphicx}");
  }

  lines.push(graphicsPath, "", BEGIN_DOC, "", bodies.join("\n\n\\clearpage\n\n"), "", END_DOC, "");

  return lines.join("\n");
}
