"use client";

import { useState } from "react";

type SelectedLecture = {
  path: string;
  title: string;
};

function defaultTitle(filePath: string) {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.tex$/i, "");
}

export default function CombineConfig({ files }: { files: string[] }) {
  const [selected, setSelected] = useState<SelectedLecture[]>([]);
  const [headerText, setHeaderText] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  function toggle(filePath: string) {
    setSelected((current) => {
      if (current.some((item) => item.path === filePath)) {
        return current.filter((item) => item.path !== filePath);
      }
      return [...current, { path: filePath, title: defaultTitle(filePath) }];
    });
  }

  function move(index: number, direction: -1 | 1) {
    setSelected((current) => {
      const next = [...current];
      const target = index + direction;

      if (target < 0 || target >= next.length) {
        return current;
      }

      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateTitle(index: number, value: string) {
    setSelected((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, title: value } : item))
    );
  }

  function removeAt(index: number) {
    setSelected((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function generate() {
    if (selected.length === 0) {
      setError("请至少选择一份讲义。");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append(
        "config",
        JSON.stringify({
          headerText,
          chapters: selected.map((item) => ({
            path: item.path,
            title: item.title.trim() || defaultTitle(item.path),
          })),
        })
      );

      if (coverFile) {
        formData.append("cover", coverFile);
      }

      const response = await fetch("/api/admin/lectures/combine", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (response.ok && contentType.includes("application/pdf")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "讲义合集.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "组合下载失败，请重试。");
      }
    } catch {
      setError("组合下载请求失败，请检查网络后重试。");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="combine-config">
      {error ? <div className="feedback-banner error">{error}</div> : null}

      <section className="form-card">
        <div className="section-heading">
          <h3>第一步 · 选择讲义</h3>
          <p>勾选要纳入合集的讲义，来源为 Gitea 仓库主分支。</p>
        </div>
        {files.length === 0 ? (
          <p className="form-hint">仓库中暂无讲义。</p>
        ) : (
          <div className="combine-pick-list">
            {files.map((filePath) => (
              <label key={filePath} className="combine-pick-row">
                <input
                  type="checkbox"
                  checked={selected.some((item) => item.path === filePath)}
                  onChange={() => toggle(filePath)}
                />
                <span>{filePath}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="form-card">
        <div className="section-heading">
          <h3>第二步 · 调整顺序与章节标题</h3>
          <p>合集按下列顺序生成，每份讲义为一章；标题默认用讲义文件名，可自行修改。</p>
        </div>
        {selected.length === 0 ? (
          <p className="form-hint">请先在上方勾选讲义。</p>
        ) : (
          <div className="combine-selected-list">
            {selected.map((item, index) => (
              <div key={item.path} className="combine-selected-item">
                <span className="combine-chapter-no">第 {index + 1} 章</span>
                <input
                  type="text"
                  className="combine-title-input"
                  value={item.title}
                  onChange={(event) => updateTitle(index, event.target.value)}
                  placeholder="章节标题"
                />
                <div className="combine-item-actions">
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => move(index, 1)}
                    disabled={index === selected.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => removeAt(index)}
                  >
                    移除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="form-card">
        <div className="section-heading">
          <h3>第三步 · 封面与页眉</h3>
          <p>封面为可选的单页 PDF；页眉文字会显示在每页左上角，右上角自动显示章节名。</p>
        </div>
        <div className="admin-form-grid">
          <label className="form-field">
            <span>封面 PDF（可选）</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="form-field">
            <span>页眉文字</span>
            <input
              type="text"
              value={headerText}
              onChange={(event) => setHeaderText(event.target.value)}
              placeholder="例如：中佳九学讲义合集"
            />
          </label>
        </div>
      </section>

      <div className="combine-bar">
        <span className="editor-action-hint">
          生成需要克隆仓库并多遍编译，可能耗时数十秒。
        </span>
        <button
          type="button"
          className="primary-button"
          onClick={() => void generate()}
          disabled={generating || selected.length === 0}
        >
          {generating ? "生成中…" : "生成并下载 PDF"}
        </button>
      </div>
    </div>
  );
}
