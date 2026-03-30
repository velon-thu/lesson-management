"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import { latex } from "codemirror-lang-latex";
import EmptyState from "@/components/empty-state";
import SubmitButton from "@/components/submit-button";

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

type TeacherEditorWorkspaceProps = {
  texFileName: string;
  texSource: string;
  pdfUrl: string | null;
  saveAction: (formData: FormData) => void | Promise<void>;
};

export default function TeacherEditorWorkspace({
  texFileName,
  texSource,
  pdfUrl,
  saveAction,
}: TeacherEditorWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const [leftWidth, setLeftWidth] = useState(58);
  const [editorFontSize, setEditorFontSize] = useState(20);
  const [editorValue, setEditorValue] = useState(texSource);

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
          indentUnit.of("  "),
          syntaxHighlighting(latexHighlightStyle),
          latexEditorTheme,
          keymap.of([
            {
              key: "Mod-/",
              run: toggleLatexComment,
            },
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setEditorValue(update.state.doc.toString());
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
  }, [texSource]);

  useEffect(() => {
    setEditorValue(texSource);

    const editorView = editorViewRef.current;
    if (!editorView) {
      return;
    }

    const currentValue = editorView.state.doc.toString();
    if (currentValue === texSource) {
      return;
    }

    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: texSource,
      },
    });
  }, [texSource]);

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
    setEditorFontSize((current) => {
      const next = current + 2;
      return Math.min(64, Math.max(18, next));
    });
  }

  function decreaseEditorFontSize() {
    setEditorFontSize((current) => {
      const next = current - 2;
      return Math.min(64, Math.max(18, next));
    });
  }

  return (
    <section className="editor-workspace form-card" ref={containerRef} style={workspaceStyle}>
      <div className="editor-pane editor-pane-editor">
        <div className="section-heading">
          <h3>LaTeX 讲义编辑区</h3>
          <div className="editor-pane-toolbar">
            <span>当前字号 {editorFontSize}px</span>
            <div className="editor-zoom-controls">
              <button type="button" className="secondary-button compact-button" onClick={decreaseEditorFontSize}>
                -
              </button>
              <button type="button" className="secondary-button compact-button" onClick={increaseEditorFontSize}>
                +
              </button>
            </div>
          </div>
        </div>
        <form action={saveAction} className="editor-form">
          <label className="form-field form-field-full">
            <span>{texFileName}</span>
            <div className="editor-syntax-shell">
              <div ref={editorHostRef} className="editor-codemirror-shell" />
            </div>
          </label>
          <input type="hidden" name="texSource" value={editorValue} />
          <div className="form-actions">
            <SubmitButton
              idleText="保存草稿"
              pendingText="保存中..."
              className="primary-button"
            />
          </div>
        </form>
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
        </div>
        {pdfUrl ? (
          <div className="editor-preview-shell">
            <iframe
              title="PDF 预览"
              src={pdfUrl}
              className="pdf-preview-frame editor-preview-frame"
            />
          </div>
        ) : (
          <div className="editor-preview-shell">
            <EmptyState
              title="暂无可预览 PDF"
              description="请先完成一次成功编译，之后这里会显示最新 PDF。"
            />
          </div>
        )}
      </div>
    </section>
  );
}
