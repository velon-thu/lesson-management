"use client";

import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { latex } from "codemirror-lang-latex";

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

type ReviseResult = {
  ok: boolean;
  message: string;
  log?: string;
};

type LectureReviseEditorProps = {
  lectureId: string;
  texFileName: string;
  initialSource: string;
  loadError?: string;
};

export default function LectureReviseEditor({
  lectureId,
  texFileName,
  initialSource,
  loadError = "",
}: LectureReviseEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<ReviseResult | null>(null);

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
          keymap.of([indentWithTab]),
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

  async function publish() {
    const view = viewRef.current;

    if (!view || publishing) {
      return;
    }

    setPublishing(true);
    setResult(null);

    try {
      const response = await fetch(`/api/admin/lectures/${lectureId}/revise`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texSource: view.state.doc.toString() }),
      });

      const data = await response.json();
      const log = typeof data?.log === "string" ? data.log : undefined;

      if (data?.ok) {
        setResult({ ok: true, message: "修改已编译通过并发布到仓库主分支。", log });
      } else {
        setResult({
          ok: false,
          message: typeof data?.error === "string" ? data.error : "发布失败。",
          log,
        });
      }
    } catch {
      setResult({ ok: false, message: "发布请求失败，请检查网络后重试。" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="form-card">
      <div className="section-heading">
        <h3>{texFileName}</h3>
        <p>直接修改已完成讲义的源码；点击发布会先编译校验，通过后才提交到仓库主分支。</p>
      </div>

      {loadError ? <div className="feedback-banner error">{loadError}</div> : null}

      <div className="editor-syntax-shell">
        <div ref={hostRef} className="editor-codemirror-shell" />
      </div>

      {result ? (
        <div className={`feedback-banner ${result.ok ? "success" : "error"}`}>{result.message}</div>
      ) : null}
      {result?.log ? (
        <div className="log-box">
          <pre>{result.log}</pre>
        </div>
      ) : null}

      <div className="editor-action-bar">
        <span className="editor-action-hint">
          轻量发布：编译通过即直接提交回主分支，不经过审核流程。
        </span>
        <button
          type="button"
          className="primary-button"
          onClick={() => void publish()}
          disabled={publishing || Boolean(loadError)}
        >
          {publishing ? "发布中…" : "保存并发布到主分支"}
        </button>
      </div>
    </section>
  );
}
