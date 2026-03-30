"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/components/empty-state";
import SubmitButton from "@/components/submit-button";

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
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(58);
  const [editorFontSize, setEditorFontSize] = useState(32);
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

  function syncHighlightScroll() {
    if (!textareaRef.current || !highlightRef.current) {
      return;
    }

    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }

  function renderHighlightedLine(line: string, lineIndex: number) {
    if (!line) {
      return <span key={`line-${lineIndex}`}>&nbsp;</span>;
    }

    const segments: Array<{ text: string; className?: string }> = [];
    const pattern = /(%.+?$|\\[a-zA-Z@]+|\\[^a-zA-Z\s]|\{|\}|\[[^\]]*\]|\$[^$]*\$)/gm;
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = pattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: line.slice(lastIndex, match.index) });
      }

      const token = match[0];
      let className = "latex-token-command";

      if (token.startsWith("%")) {
        className = "latex-token-comment";
      } else if (token === "{" || token === "}") {
        className = "latex-token-brace";
      } else if (token.startsWith("[") && token.endsWith("]")) {
        className = "latex-token-option";
      } else if (token.startsWith("$") && token.endsWith("$")) {
        className = "latex-token-math";
      }

      segments.push({ text: token, className });
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < line.length) {
      segments.push({ text: line.slice(lastIndex) });
    }

    return (
      <span key={`line-${lineIndex}`}>
        {segments.map((segment, segmentIndex) => (
          <span
            key={`segment-${lineIndex}-${segmentIndex}`}
            className={segment.className}
          >
            {segment.text}
          </span>
        ))}
      </span>
    );
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
              <pre ref={highlightRef} className="editor-highlight-layer" aria-hidden="true">
                {editorValue.split("\n").map((line, index, array) => (
                  <span key={`row-${index}`}>
                    {renderHighlightedLine(line, index)}
                    {index < array.length - 1 ? "\n" : ""}
                  </span>
                ))}
              </pre>
              <textarea
                ref={textareaRef}
                name="texSource"
                rows={24}
                value={editorValue}
                onChange={(event) => setEditorValue(event.target.value)}
                onScroll={syncHighlightScroll}
                spellCheck={false}
                className="editor-textarea editor-textarea-overlay"
              />
            </div>
          </label>
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
