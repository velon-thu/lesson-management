import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  compilePreviewAction,
  saveTaskDraftAction,
  submitTaskReviewAction,
  uploadTaskAssetAction,
} from "@/app/teacher/tasks/actions";
import { getOwnedTeacherTask } from "@/lib/teacher-task";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";
import SubmitButton from "@/components/submit-button";
import TeacherSectionNav from "@/components/teacher-section-nav";

const errorMessages: Record<string, string> = {
  "missing-draft": "当前任务没有可写入的草稿记录。",
  empty: "main.tex 为空，不能直接提交审核。",
  "compile-required": "请先确保最近一次编译成功，再提交审核。",
  file: "请选择要上传的图片文件。",
  "image-only": "目前仅支持上传图片文件。",
};

type PageProps = {
  params: {
    taskId: string;
  };
  searchParams?: {
    success?: string;
    error?: string;
    snippet?: string;
  };
};

export default async function TeacherTaskEditPage({ params, searchParams }: PageProps) {
  const user = await requireRole("teacher");
  const task = await getOwnedTeacherTask(params.taskId, user.id);
  const saveDraft = saveTaskDraftAction.bind(null, task.id);
  const compilePreview = compilePreviewAction.bind(null, task.id);
  const submitReview = submitTaskReviewAction.bind(null, task.id);
  const uploadAsset = uploadTaskAssetAction.bind(null, task.id);
  const success = searchParams?.success ?? "";
  const error = searchParams?.error ? errorMessages[searchParams.error] ?? searchParams.error : "";
  const snippet = searchParams?.snippet ? decodeURIComponent(searchParams.snippet) : "";
  const compileStatus = task.lastCompileStatus ?? "NOT_COMPILED";
  const showCompileTime =
    task.lastCompileStatus === "SUCCESS" || task.lastCompileStatus === "FAILED";

  return (
    <PageContainer
      title="编辑 main.tex"
      subtitle="第一版仅提供纯文本 LaTeX 编辑、保存草稿、提交审核和图片上传。"
      badge="Task Editor"
      actions={
        <Link href={`/teacher/tasks/${task.id}`} className="secondary-link-button">
          返回任务详情
        </Link>
      }
    >
      <TeacherSectionNav />

      <section className="summary-banner">
        <div>
          <h2>{task.title}</h2>
          <p>
            所属讲义：{task.lecture.code} / {task.lecture.title}
          </p>
        </div>
        <span className="status-pill status-teacher">{task.status}</span>
      </section>

      {success === "saved" ? (
        <div className="feedback-banner success">草稿已保存到数据库。</div>
      ) : null}
      {success === "submitted" ? (
        <div className="feedback-banner success">已提交审核，当前等待管理员处理。</div>
      ) : null}
      {success === "compiled" ? (
        <div className="feedback-banner success">编译完成，现在可以预览 PDF。</div>
      ) : null}
      {success === "compile-failed" ? (
        <div className="feedback-banner error">编译失败，请查看下方日志。</div>
      ) : null}
      {success === "uploaded" ? (
        <div className="feedback-banner success">图片已上传，下面提供可复制的 LaTeX 引用片段。</div>
      ) : null}
      {error ? <div className="feedback-banner error">{error}</div> : null}

      <section className="editor-layout">
        <div className="editor-main">
          <section className="form-card">
            <form action={saveDraft} className="editor-form">
              <label className="form-field form-field-full">
                <span>main.tex</span>
                <textarea
                  name="texSource"
                  rows={24}
                  defaultValue={task.draft?.texSource ?? ""}
                  className="editor-textarea"
                />
              </label>
              <div className="form-actions">
                <SubmitButton
                  idleText="保存草稿"
                  pendingText="保存中..."
                  className="primary-button"
                />
              </div>
            </form>
          </section>

          <section className="form-card">
            <div className="section-heading">
              <h3>编译预览</h3>
              <p>固定使用 xelatex，在隔离临时目录中编译，不开启 shell-escape。</p>
            </div>
            <div className="compile-meta">
              <div className="detail-card">
                <h3>最近一次编译状态</h3>
                <p>{compileStatus}</p>
              </div>
              <div className="detail-card">
                <h3>最近一次编译时间</h3>
                <p>
                  {showCompileTime
                    ? task.updatedAt.toISOString().replace("T", " ").slice(0, 16)
                    : "暂无成功/失败编译记录"}
                </p>
              </div>
            </div>
            <form action={compilePreview}>
              <SubmitButton
                idleText="编译预览"
                pendingText="编译中..."
                className="secondary-button"
              />
            </form>
          </section>

          <section className="form-card">
            <div className="section-heading">
              <h3>提交审核</h3>
              <p>提交前会做基础校验：main.tex 不能为空，且最近一次编译必须成功。</p>
            </div>
            <form action={submitReview}>
              <SubmitButton
                idleText="提交审核"
                pendingText="提交中..."
                className="secondary-button"
              />
            </form>
          </section>
        </div>

        <aside className="editor-sidebar">
          <section className="form-card">
            <div className="section-heading">
              <h3>上传图片</h3>
              <p>上传成功后会记录到 `assets` 表，并生成可复制的 LaTeX 引用片段。</p>
            </div>
            <form action={uploadAsset} className="upload-form">
              <label className="form-field">
                <span>选择图片</span>
                <input name="asset" type="file" accept="image/*" />
              </label>
              <SubmitButton
                idleText="上传图片"
                pendingText="上传中..."
                className="secondary-button"
              />
            </form>

            {snippet ? (
              <div className="snippet-box">
                <h4>LaTeX 引用片段</h4>
                <textarea readOnly rows={4} value={snippet} />
              </div>
            ) : null}
          </section>

          <section className="form-card">
            <div className="section-heading">
              <h3>PDF 预览</h3>
            </div>
            {task.lastCompileStatus === "SUCCESS" && task.lastPdfPath ? (
              <iframe
                title="PDF 预览"
                src={`/api/teacher/tasks/${task.id}/pdf`}
                className="pdf-preview-frame"
              />
            ) : (
              <EmptyState
                title="暂无可预览 PDF"
                description="请先完成一次成功编译，之后这里会显示最新 PDF。"
              />
            )}
          </section>

          <section className="form-card">
            <div className="section-heading">
              <h3>最近审核意见</h3>
            </div>
            {task.reviewRecords.length === 0 ? (
              <EmptyState
                title="暂无审核意见"
                description="提交审核后，这里会显示最近的审核记录。"
              />
            ) : (
              <div className="review-list">
                {task.reviewRecords.map((record) => (
                  <div key={record.id} className="review-item">
                    <strong>{record.action}</strong>
                    <p>{record.comment || "暂无意见内容"}</p>
                    <span>
                      {record.reviewer.name} ({record.reviewer.username}) /{" "}
                      {record.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="form-card">
            <div className="section-heading">
              <h3>编译日志</h3>
            </div>
            {task.lastCompileLog ? (
              <div className="log-box">
                <pre>{task.lastCompileLog}</pre>
              </div>
            ) : (
              <EmptyState
                title="暂无编译日志"
                description="首次编译后，这里会显示最近一次编译的输出日志。"
              />
            )}
          </section>

          <section className="form-card">
            <div className="section-heading">
              <h3>已上传素材</h3>
            </div>
            {task.assets.length === 0 ? (
              <EmptyState
                title="暂无素材"
                description="上传图片后，这里会显示最近素材记录。"
              />
            ) : (
              <div className="asset-list">
                {task.assets.map((asset) => (
                  <div key={asset.id} className="asset-item">
                    <strong>{asset.fileName}</strong>
                    <p>{asset.filePath}</p>
                    <span>{asset.createdAt.toISOString().replace("T", " ").slice(0, 16)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>
    </PageContainer>
  );
}
