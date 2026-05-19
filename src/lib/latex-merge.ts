type BookletChapter = {
  title: string;
  source: string;
  graphicsDir?: string;
};

type BuildBookletInput = {
  chapters: BookletChapter[];
  headerText: string;
  coverFileName?: string;
};

const BEGIN_DOC = "\\begin{document}";
const END_DOC = "\\end{document}";

/** 取出一份完整 LaTeX 源码的正文（\begin{document} 与 \end{document} 之间）。 */
function extractBody(source: string): string {
  const beginIdx = source.indexOf(BEGIN_DOC);
  const endIdx = source.lastIndexOf(END_DOC);

  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    return source.trim();
  }

  return source.slice(beginIdx + BEGIN_DOC.length, endIdx).trim();
}

/** 转义 LaTeX 特殊字符，用于把用户输入安全地放进章节标题、页眉等位置。 */
function escapeLatex(input: string): string {
  return input
    .split("\\")
    .map((segment) =>
      segment
        .replace(/([&%#_${}])/g, "\\$1")
        .replace(/~/g, "\\textasciitilde{}")
        .replace(/\^/g, "\\textasciicircum{}")
    )
    .join("\\textbackslash{}");
}

/**
 * 把多份讲义组装成一本可编译的「讲义合集」：ctexbook 书籍类，
 * 每份讲义一章（\chapter，中文编号「第一章」），带目录、自定义页眉，
 * 可选用 pdfpages 插入封面 PDF。
 */
export function buildLectureBooklet({ chapters, headerText, coverFileName }: BuildBookletInput): string {
  if (chapters.length === 0) {
    throw new Error("请至少选择一份讲义。");
  }

  const graphicsDirs = Array.from(
    new Set(chapters.map((chapter) => (chapter.graphicsDir ?? "").trim()))
  );
  const graphicsPath = `\\graphicspath{${graphicsDirs
    .map((dir) => `{${dir ? `${dir}/` : "./"}}`)
    .join("")}}`;

  const preamble = [
    "\\documentclass[12pt]{ctexbook}",
    "\\usepackage{amsmath,amssymb,amsthm}",
    "\\usepackage{geometry}",
    "\\geometry{a4paper,margin=2.5cm}",
    "\\usepackage{graphicx}",
    "\\usepackage{enumitem}",
    "\\usepackage{fancyhdr}",
    coverFileName ? "\\usepackage{pdfpages}" : "",
    graphicsPath,
    "\\theoremstyle{definition}",
    "\\newtheorem{definition}{定义}[section]",
    "\\newtheorem{example}{例}[section]",
    "\\theoremstyle{plain}",
    "\\newtheorem{theorem}{定理}[section]",
    "\\newtheorem{lemma}{引理}[section]",
    "\\newtheorem{corollary}{推论}[section]",
    "\\theoremstyle{remark}",
    "\\newtheorem*{remark}{注}",
    "\\setlength{\\headheight}{15pt}",
    "\\pagestyle{fancy}",
    "\\fancyhf{}",
    `\\fancyhead[L]{${escapeLatex(headerText.trim())}}`,
    "\\fancyhead[R]{\\leftmark}",
    "\\fancyfoot[C]{\\thepage}",
    "\\renewcommand{\\headrulewidth}{0.4pt}",
  ].filter(Boolean);

  const body: string[] = [];

  if (coverFileName) {
    body.push(`\\includepdf[pages=1,pagecommand={\\thispagestyle{empty}}]{${coverFileName}}`);
  }

  body.push("\\tableofcontents", "");

  for (const chapter of chapters) {
    const chapterBody = extractBody(chapter.source).replace(/\\maketitle/g, "").trim();
    body.push(`\\chapter{${escapeLatex(chapter.title.trim())}}`, "", chapterBody, "");
  }

  return [...preamble, "", "\\begin{document}", "", ...body, "\\end{document}", ""].join("\n");
}
