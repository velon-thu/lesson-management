type LectureTemplateInput = {
  title: string;
  description: string | null;
  templatePath: string;
};

type TaskTemplateInput = {
  taskId: string;
  teacherName: string;
  lecture: LectureTemplateInput;
};

/**
 * 所有讲义共用的标准数学讲义 LaTeX 模板。
 * 单份独立文档（ctexart），老师可单独编译预览；组合下载时后端会抽取其正文并入书籍。
 */
export function buildInitialTexSource({ taskId, teacherName, lecture }: TaskTemplateInput) {
  const description = lecture.description?.trim() || "待补充讲义说明";

  return [
    "% 本文件由讲义管理系统在分配任务时自动生成。",
    `% 任务编号：${taskId}`,
    `% 讲义说明：${description}`,
    "\\documentclass[12pt]{ctexart}",
    "\\usepackage{amsmath,amssymb,amsthm}",
    "\\usepackage{geometry}",
    "\\geometry{a4paper,margin=2.5cm}",
    "\\usepackage{graphicx}",
    "\\usepackage{enumitem}",
    "",
    "% ===== 数学环境 =====",
    "\\theoremstyle{definition}",
    "\\newtheorem{definition}{定义}[section]",
    "\\newtheorem{example}{例}[section]",
    "\\theoremstyle{plain}",
    "\\newtheorem{theorem}{定理}[section]",
    "\\newtheorem{lemma}{引理}[section]",
    "\\newtheorem{corollary}{推论}[section]",
    "\\theoremstyle{remark}",
    "\\newtheorem*{remark}{注}",
    "",
    `\\title{${lecture.title}}`,
    `\\author{${teacherName}}`,
    "\\date{}",
    "",
    "\\begin{document}",
    "\\maketitle",
    "",
    "\\section{知识引入}",
    "",
    "在此撰写本节的引入内容。",
    "",
    "\\section{核心内容}",
    "",
    "\\begin{definition}",
    "在此给出定义。",
    "\\end{definition}",
    "",
    "\\begin{theorem}",
    "在此给出定理，并按需补充证明。",
    "\\end{theorem}",
    "",
    "\\begin{example}",
    "在此给出例题与解答。",
    "\\end{example}",
    "",
    "\\section{课堂练习}",
    "",
    "\\begin{enumerate}",
    "  \\item 在此撰写练习题。",
    "\\end{enumerate}",
    "",
    "\\end{document}",
    "",
  ].join("\n");
}
