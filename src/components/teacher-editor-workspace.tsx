"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { snippetCompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { lintGutter, setDiagnostics as setCmDiagnostics, type Diagnostic } from "@codemirror/lint";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import { latex } from "codemirror-lang-latex";
import EmptyState from "@/components/empty-state";
import type { LatexDiagnostic } from "@/lib/latex-log";

const latexHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword],
    color: "#7c3aed",
    fontWeight: "700",
  },
  {
    tag: [tags.tagName, tags.attributeName, tags.macroName, tags.special(tags.name)],
    color: "#2563eb",
    fontWeight: "700",
  },
  {
    tag: [tags.heading, tags.labelName],
    color: "#c2410c",
    fontWeight: "700",
  },
  {
    tag: [tags.atom, tags.meta],
    color: "#0891b2",
  },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "#0f766e",
  },
  {
    tag: [tags.number, tags.integer, tags.float],
    color: "#dc2626",
  },
  {
    tag: [tags.comment],
    color: "#94a3b8",
    fontStyle: "italic",
  },
  {
    tag: [tags.brace, tags.squareBracket, tags.paren, tags.separator],
    color: "#d97706",
  },
  {
    tag: [tags.emphasis],
    fontStyle: "italic",
  },
  {
    tag: [tags.strong],
    fontWeight: "700",
  },
]);

const latexEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontSize: "var(--editor-font-size, 20px)",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    height: "100%",
    overflow: "auto",
    fontFamily: '"SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, monospace',
    lineHeight: "1.7",
  },
  ".cm-gutters": {
    minHeight: "100%",
    borderRight: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    color: "#94a3b8",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 10px 0 12px",
  },
  ".cm-content": {
    minHeight: "100%",
    caretColor: "#2563eb",
    padding: "20px 16px 20px 0",
  },
  ".cm-line": {
    padding: "0 0 0 16px",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#2563eb",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(59, 130, 246, 0.20)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(37, 99, 235, 0.05)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    color: "#64748b",
  },
  ".cm-matchingBracket": {
    backgroundColor: "rgba(124, 58, 237, 0.12)",
    color: "#7c3aed",
  },
}, { dark: false });

function toggleLatexComment(view: EditorView) {
  const { state } = view;
  const range = state.selection.main;
  const rangeEnd = range.empty ? range.to : Math.max(range.from, range.to - 1);
  const startLine = state.doc.lineAt(range.from);
  const endLine = state.doc.lineAt(rangeEnd);
  const lines = [];

  for (let number = startLine.number; number <= endLine.number; number += 1) {
    lines.push(state.doc.line(number));
  }

  const nonEmptyLines = lines.filter((line) => line.text.trim().length > 0);
  const shouldUncomment =
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every((line) => line.text.trimStart().startsWith("%"));

  const changes: Array<{ from: number; to?: number; insert: string }> = [];

  for (const line of lines) {
    const indentLength = line.text.match(/^\s*/)?.[0].length ?? 0;
    const markerFrom = line.from + indentLength;
    const content = line.text.slice(indentLength);

    if (shouldUncomment) {
      if (content.startsWith("% ")) {
        changes.push({ from: markerFrom, to: markerFrom + 2, insert: "" });
      } else if (content.startsWith("%")) {
        changes.push({ from: markerFrom, to: markerFrom + 1, insert: "" });
      }

      continue;
    }

    if (!line.text.trim()) {
      continue;
    }

    changes.push({ from: markerFrom, insert: "% " });
  }

  if (!changes.length && !shouldUncomment) {
    changes.push({ from: startLine.from, insert: "% " });
  }

  view.dispatch({
    changes,
    userEvent: "input.comment",
  });

  return true;
}

// 常用 LaTeX 命令补全（${} 为光标停留位、${name} 为可联动占位符）。
const LATEX_COMMAND_SNIPPETS: Array<[string, string]> = [
  ["\\section", "\\section{${}}"],
  ["\\subsection", "\\subsection{${}}"],
  ["\\subsubsection", "\\subsubsection{${}}"],
  ["\\textbf", "\\textbf{${}}"],
  ["\\textit", "\\textit{${}}"],
  ["\\emph", "\\emph{${}}"],
  ["\\underline", "\\underline{${}}"],
  ["\\item", "\\item ${}"],
  ["\\begin", "\\begin{${env}}\n\t${}\n\\end{${env}}"],
  ["\\frac", "\\frac{${}}{${}}"],
  ["\\sqrt", "\\sqrt{${}}"],
  ["\\label", "\\label{${}}"],
  ["\\ref", "\\ref{${}}"],
  ["\\eqref", "\\eqref{${}}"],
  ["\\cite", "\\cite{${}}"],
  ["\\caption", "\\caption{${}}"],
  ["\\footnote", "\\footnote{${}}"],
  ["\\includegraphics", "\\includegraphics[width=0.8\\textwidth]{${}}"],
  ["\\usepackage", "\\usepackage{${}}"],
  ["\\href", "\\href{${url}}{${}}"],
];

const LATEX_ENVIRONMENTS = [
  "equation",
  "align",
  "itemize",
  "enumerate",
  "figure",
  "table",
  "tabular",
  "center",
  "quote",
  "verbatim",
  "matrix",
  "cases",
  "theorem",
  "proof",
  "abstract",
];

function latexCompletionSource(context: CompletionContext): CompletionResult | null {
  const beginMatch = context.matchBefore(/\\begin\{[a-zA-Z*]*/);

  if (beginMatch) {
    return {
      from: beginMatch.from + "\\begin{".length,
      options: LATEX_ENVIRONMENTS.map((env) => ({ label: env, type: "type" })),
      validFor: /^[a-zA-Z*]*$/,
    };
  }

  const commandMatch = context.matchBefore(/\\[a-zA-Z]*/);

  if (!commandMatch || (commandMatch.from === commandMatch.to && !context.explicit)) {
    return null;
  }

  return {
    from: commandMatch.from,
    options: LATEX_COMMAND_SNIPPETS.map(([label, template]) =>
      snippetCompletion(template, { label, type: "keyword" })
    ),
    validFor: /^\\[a-zA-Z]*$/,
  };
}

type SaveState = "saved" | "saving" | "unsaved";

const AUTO_SAVE_DELAY_MS = 1500;

const COMPILE_STATUS_META: Record<string, { label: string; className: string }> = {
  SUCCESS: { label: "编译成功", className: "is-success" },
  FAILED: { label: "编译失败", className: "is-failed" },
  PENDING_RECOMPILE: { label: "待重新编译", className: "is-pending" },
  NOT_COMPILED: { label: "尚未编译", className: "is-idle" },
};

function formatCompileTime(iso: string) {
  if (!iso) {
    return "";
  }

  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toISOString().replace("T", " ").slice(0, 16);
}

type TeacherEditorWorkspaceProps = {
  taskId: string;
  texFileName: string;
  texSource: string;
  initialHasPdf: boolean;
  initialCompileStatus: string;
  initialCompileLog: string;
  initialCompiledAt: string;
};

export default function TeacherEditorWorkspace({
  taskId,
  texFileName,
  texSource,
  initialHasPdf,
  initialCompileStatus,
  initialCompileLog,
  initialCompiledAt,
}: TeacherEditorWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compilingRef = useRef(false);

  const [leftWidth, setLeftWidth] = useState(58);
  const [editorFontSize, setEditorFontSize] = useState(20);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [compiling, setCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState(initialCompileStatus || "NOT_COMPILED");
  const [compileLog, setCompileLog] = useState(initialCompileLog);
  const [compiledAt, setCompiledAt] = useState(initialCompiledAt);
  const [diagnostics, setDiagnostics] = useState<LatexDiagnostic[]>([]);
  const [hasPdf, setHasPdf] = useState(initialHasPdf);
  const [pdfVersion, setPdfVersion] = useState(0);

  // keymap 在编辑器初始化时绑定一次，通过 ref 调用最新的处理函数。
  const compileRef = useRef<() => void>(() => {});
  const saveRef = useRef<() => void>(() => {});
  const docChangedRef = useRef<() => void>(() => {});

  function applyDiagnosticsToEditor(items: LatexDiagnostic[]) {
    const view = editorViewRef.current;

    if (!view) {
      return;
    }

    const totalLines = view.state.doc.lines;
    const cmDiagnostics: Diagnostic[] = items.map((item) => {
      const lineNo = Math.min(Math.max(item.line, 1), totalLines);
      const line = view.state.doc.line(lineNo);

      return {
        from: line.from,
        to: line.to,
        severity: item.severity,
        message: item.message,
      };
    });

    view.dispatch(setCmDiagnostics(view.state, cmDiagnostics));
  }

  function jumpToLine(lineNo: number) {
    const view = editorViewRef.current;

    if (!view) {
      return;
    }

    const clamped = Math.min(Math.max(lineNo, 1), view.state.doc.lines);
    const line = view.state.doc.line(clamped);

    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    view.focus();
  }

  async function persistDraft(): Promise<boolean> {
    const view = editorViewRef.current;

    if (!view) {
      return false;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    setSaveState("saving");

    try {
      const response = await fetch(`/api/teacher/tasks/${taskId}/draft`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texSource: view.state.doc.toString() }),
      });

      if (!response.ok) {
        setSaveState("unsaved");
        return false;
      }

      setSaveState("saved");
      return true;
    } catch {
      setSaveState("unsaved");
      return false;
    }
  }

  async function runCompile() {
    const view = editorViewRef.current;

    if (!view || compilingRef.current) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    compilingRef.current = true;
    setCompiling(true);
    setSaveState("saving");

    try {
      const response = await fetch(`/api/teacher/tasks/${taskId}/compile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texSource: view.state.doc.toString() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSaveState("unsaved");
        setCompileStatus("FAILED");
        setCompileLog(typeof data?.error === "string" ? data.error : "编译请求失败。");
        return;
      }

      setSaveState("saved");
      setCompileStatus(typeof data.status === "string" ? data.status : "FAILED");
      setCompileLog(typeof data.log === "string" ? data.log : "");
      setCompiledAt(typeof data.compiledAt === "string" ? data.compiledAt : "");

      const nextDiagnostics: LatexDiagnostic[] = Array.isArray(data.diagnostics)
        ? data.diagnostics
        : [];
      setDiagnostics(nextDiagnostics);
      applyDiagnosticsToEditor(nextDiagnostics);

      if (data.hasPdf) {
        setHasPdf(true);
        setPdfVersion((version) => version + 1);
      }
    } catch {
      setSaveState("unsaved");
      setCompileStatus("FAILED");
      setCompileLog("编译请求失败，请检查网络后重试。");
    } finally {
      compilingRef.current = false;
      setCompiling(false);
    }
  }

  function handleDocChanged() {
    setSaveState("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      void persistDraft();
    }, AUTO_SAVE_DELAY_MS);
  }

  // 每次渲染都把最新的处理函数写入 ref，供编辑器 keymap / updateListener 调用。
  compileRef.current = () => {
    void runCompile();
  };
  saveRef.current = () => {
    void persistDraft();
  };
  docChangedRef.current = handleDocChanged;

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const nextWidth = ((event.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(75, Math.max(35, nextWidth)));
    }

    function handleMouseUp() {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const workspaceStyle = useMemo(
    () =>
      ({
        "--editor-left-width": `${leftWidth}%`,
        "--editor-font-size": `${editorFontSize}px`,
      }) as CSSProperties,
    [editorFontSize, leftWidth]
  );

  useEffect(() => {
    if (!editorHostRef.current || editorViewRef.current) {
      return;
    }

    const editorView = new EditorView({
      state: EditorState.create({
        doc: texSource,
        extensions: [
          basicSetup,
          latex({
            autoCloseTags: true,
            enableLinting: true,
            enableTooltips: true,
          }),
          lintGutter(),
          indentUnit.of("  "),
          syntaxHighlighting(latexHighlightStyle),
          latexEditorTheme,
          EditorState.languageData.of(() => [{ autocomplete: latexCompletionSource }]),
          keymap.of([
            {
              key: "Mod-/",
              run: toggleLatexComment,
            },
            {
              key: "Mod-Enter",
              preventDefault: true,
              run: () => {
                compileRef.current();
                return true;
              },
            },
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                saveRef.current();
                return true;
              },
            },
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              docChangedRef.current();
            }
          }),
        ],
      }),
      parent: editorHostRef.current,
    });

    editorViewRef.current = editorView;

    return () => {
      editorView.destroy();
      editorViewRef.current = null;
    };
    // texSource 仅在整页刷新（组件重新挂载）时变化，此处只需初始化一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (window.innerWidth <= 900) {
      return;
    }

    event.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function increaseEditorFontSize() {
    setEditorFontSize((current) => Math.min(64, Math.max(18, current + 2)));
  }

  function decreaseEditorFontSize() {
    setEditorFontSize((current) => Math.min(64, Math.max(18, current - 2)));
  }

  const saveStateText =
    saveState === "saved" ? "已保存" : saveState === "saving" ? "保存中…" : "未保存";
  const statusMeta = COMPILE_STATUS_META[compileStatus] ?? COMPILE_STATUS_META.NOT_COMPILED;
  const errorCount = diagnostics.filter((item) => item.severity === "error").length;
  const warningCount = diagnostics.filter((item) => item.severity === "warning").length;
  const compiledAtText = formatCompileTime(compiledAt);

  return (
    <>
      <section className="editor-workspace form-card" ref={containerRef} style={workspaceStyle}>
        <div className="editor-pane editor-pane-editor">
          <div className="section-heading">
            <h3>LaTeX 讲义编辑区</h3>
            <div className="editor-pane-toolbar">
              <span className={`editor-save-indicator is-${saveState}`}>{saveStateText}</span>
              <span>字号 {editorFontSize}px</span>
              <div className="editor-zoom-controls">
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={decreaseEditorFontSize}
                >
                  -
                </button>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={increaseEditorFontSize}
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="editor-form">
            <label className="form-field form-field-full">
              <span>{texFileName}</span>
              <div className="editor-syntax-shell">
                <div ref={editorHostRef} className="editor-codemirror-shell" />
              </div>
            </label>
            <div className="editor-action-bar">
              <span className="editor-action-hint">
                编译即保存草稿，快捷键 Ctrl/⌘ + Enter；Ctrl/⌘ + S 仅保存
              </span>
              <button
                type="button"
                className="primary-button"
                onClick={() => void runCompile()}
                disabled={compiling}
              >
                {compiling ? "编译中…" : "重新编译"}
              </button>
            </div>
          </div>
        </div>

        <div
          className="editor-resizer"
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整编辑区和预览区宽度"
        />

        <div className="editor-pane editor-pane-preview">
          <div className="section-heading">
            <h3>PDF 预览</h3>
            <span className={`compile-status-pill ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>
          {hasPdf ? (
            <div className="editor-preview-shell">
              <iframe
                title="PDF 预览"
                src={`/api/teacher/tasks/${taskId}/pdf?v=${pdfVersion}`}
                className="pdf-preview-frame editor-preview-frame"
              />
            </div>
          ) : (
            <div className="editor-preview-shell">
              <EmptyState
                title="暂无可预览 PDF"
                description="点击「重新编译」，编译成功后这里会显示最新 PDF。"
              />
            </div>
          )}
        </div>
      </section>

      <section className="editor-bottom-grid">
        <section className="form-card">
          <div className="section-heading">
            <h3>编译问题</h3>
            <p>
              {errorCount} 个错误 · {warningCount} 个警告
            </p>
          </div>
          {diagnostics.length === 0 ? (
            <EmptyState
              title="暂无可定位的编译问题"
              description="编译后，能定位到行号的错误与警告会出现在这里，点击即可跳转。"
            />
          ) : (
            <div className="diagnostic-list">
              {diagnostics.map((item, index) => (
                <button
                  key={`${item.severity}-${item.line}-${index}`}
                  type="button"
                  className={`diagnostic-item is-${item.severity}`}
                  onClick={() => jumpToLine(item.line)}
                >
                  <span className="diagnostic-line">
                    第 {item.line} 行 · {item.severity === "error" ? "错误" : "警告"}
                  </span>
                  <span className="diagnostic-message">{item.message}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="form-card">
          <div className="section-heading">
            <h3>编译日志</h3>
            <p>{compiledAtText ? `最近编译：${compiledAtText}` : "固定使用 xelatex 在隔离临时目录中编译"}</p>
          </div>
          {compileLog ? (
            <div className="log-box">
              <pre>{compileLog}</pre>
            </div>
          ) : (
            <EmptyState
              title="暂无编译日志"
              description="首次编译后，这里会显示 xelatex 的输出日志。"
            />
          )}
        </section>
      </section>
    </>
  );
}
