"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { latex } from "codemirror-lang-latex";
import EmptyState from "@/components/empty-state";

const editorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#ffffff",
      color: "#0f172a",
      fontSize: "16px",
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
    ".cm-content": {
      padding: "16px 0",
    },
  },
  { dark: false }
);

const COMPILE_STATUS_META: Record<string, { label: string; className: string }> = {
  SUCCESS: { label: "编译成功", className: "is-success" },
  FAILED: { label: "编译失败", className: "is-failed" },
  IDLE: { label: "尚未编译", className: "is-idle" },
};

function base64ToBlobUrl(base64: string) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

type PublishResult = {
  ok: boolean;
  message: string;
};

type LectureReviseEditorProps = {
  lecturePath: string;
  texFileName: string;
  initialSource: string;
  loadError?: string;
  compileEndpoint?: string;
  submitEndpoint?: string;
  submitLabel?: string;
  successRedirect?: string;
};

export default function LectureReviseEditor({
  lecturePath,
  texFileName,
  initialSource,
  loadError = "",
  compileEndpoint = "/api/admin/lectures/compile-preview",
  submitEndpoint = "/api/admin/lectures/revise",
  submitLabel = "保存并发布到主分支",
  successRedirect,
}: LectureReviseEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const compileRef = useRef<() => void>(() => {});

  const [leftWidth, setLeftWidth] = useState(55);
  const [compiling, setCompiling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [compileStatus, setCompileStatus] = useState("IDLE");
  const [compileLog, setCompileLog] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);

  function applyPdf(base64: string | null) {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }

    if (base64) {
      const url = base64ToBlobUrl(base64);
      pdfUrlRef.current = url;
      setPdfUrl(url);
    }
  }

  async function runCompilePreview() {
    const view = viewRef.current;

    if (!view || compiling || publishing) {
      return;
    }

    setCompiling(true);
    setResult(null);

    try {
      const response = await fetch(compileEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: lecturePath, texSource: view.state.doc.toString() }),
      });

      const data = await response.json();
      setCompileLog(typeof data?.log === "string" ? data.log : "");

      if (data?.ok && typeof data?.pdf === "string") {
        applyPdf(data.pdf);
        setCompileStatus("SUCCESS");
      } else {
        setCompileStatus("FAILED");
      }
    } catch {
      setCompileLog("编译请求失败，请检查网络后重试。");
      setCompileStatus("FAILED");
    } finally {
      setCompiling(false);
    }
  }

  async function publish() {
    const view = viewRef.current;

    if (!view || publishing || compiling) {
      return;
    }

    setPublishing(true);
    setResult(null);

    try {
      const response = await fetch(submitEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: lecturePath, texSource: view.state.doc.toString() }),
      });

      const data = await response.json();

      if (typeof data?.log === "string") {
        setCompileLog(data.log);
      }

      if (data?.ok) {
        if (successRedirect) {
          window.location.assign(successRedirect);
          return;
        }
        applyPdf(typeof data?.pdf === "string" ? data.pdf : null);
        setCompileStatus("SUCCESS");
        setResult({ ok: true, message: "修改已编译通过并发布到仓库主分支。" });
      } else {
        setCompileStatus("FAILED");
        setResult({
          ok: false,
          message: typeof data?.error === "string" ? data.error : "发布失败。",
        });
      }
    } catch {
      setResult({ ok: false, message: "发布请求失败，请检查网络后重试。" });
    } finally {
      setPublishing(false);
    }
  }

  compileRef.current = () => {
    void runCompilePreview();
  };

  useEffect(() => {
    if (!hostRef.current || viewRef.current) {
      return;
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: initialSource,
        extensions: [
          basicSetup,
          latex({
            autoCloseTags: true,
            enableLinting: true,
            enableTooltips: true,
          }),
          indentUnit.of("  "),
          editorTheme,
          keymap.of([
            indentWithTab,
            {
              key: "Mod-Enter",
              preventDefault: true,
              run: () => {
                compileRef.current();
                return true;
              },
            },
          ]),
        ],
      }),
      parent: hostRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [initialSource]);

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

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
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

  const workspaceStyle = { "--editor-left-width": `${leftWidth}%` } as CSSProperties;
  const statusMeta = COMPILE_STATUS_META[compileStatus] ?? COMPILE_STATUS_META.IDLE;

  return (
    <>
      {loadError ? <div className="feedback-banner error">{loadError}</div> : null}
      {result ? (
        <div className={`feedback-banner ${result.ok ? "success" : "error"}`}>{result.message}</div>
      ) : null}

      <section className="editor-workspace form-card" ref={containerRef} style={workspaceStyle}>
        <div className="editor-pane editor-pane-editor">
          <div className="section-heading">
            <h3>LaTeX 源码 · {texFileName}</h3>
          </div>
          <div className="editor-form">
            <label className="form-field form-field-full">
              <span>{texFileName}</span>
              <div className="editor-syntax-shell">
                <div ref={hostRef} className="editor-codemirror-shell" />
              </div>
            </label>
            <div className="editor-action-bar">
              <span className="editor-action-hint">
                Ctrl/⌘ + Enter 可快速编译预览；确认操作前会先编译校验，通过才会执行
              </span>
              <div className="editor-button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void runCompilePreview()}
                  disabled={compiling || publishing || Boolean(loadError)}
                >
                  {compiling ? "编译中…" : "编译预览"}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void publish()}
                  disabled={compiling || publishing || Boolean(loadError)}
                >
                  {publishing ? "处理中…" : submitLabel}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className="editor-resizer"
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整代码区和预览区宽度"
        />

        <div className="editor-pane editor-pane-preview">
          <div className="section-heading">
            <h3>PDF 编译预览</h3>
            <span className={`compile-status-pill ${statusMeta.className}`}>{statusMeta.label}</span>
          </div>
          {pdfUrl ? (
            <div className="editor-preview-shell">
              <iframe
                title="PDF 编译预览"
                src={pdfUrl}
                className="pdf-preview-frame editor-preview-frame"
              />
            </div>
          ) : (
            <div className="editor-preview-shell">
              <EmptyState
                title="暂无编译预览"
                description="点击「编译预览」，编译成功后这里会显示 PDF。"
              />
            </div>
          )}
        </div>
      </section>

      {compileLog ? (
        <section className="form-card">
          <div className="section-heading">
            <h3>编译日志</h3>
          </div>
          <div className="log-box">
            <pre>{compileLog}</pre>
          </div>
        </section>
      ) : null}
    </>
  );
}
