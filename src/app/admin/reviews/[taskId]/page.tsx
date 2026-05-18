import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTaskMainTexDiff } from "@/lib/gitea-submit";
import { getLectureTexFileName } from "@/lib/lecture-repo-path";
import { prisma } from "@/lib/prisma";
import AdminSectionNav from "@/components/admin-section-nav";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";
import { handleReviewDecisionAction } from "@/app/admin/reviews/actions";

const errorMessages: Record<string, string> = {
  "comment-required": "退回修改时必须填写审核意见。",
  "missing-submission": "当前任务还没有有效的提交记录。",
  "missing-branch": "当前任务缺少分支信息或最新提交记录，无法合并。",
  "invalid-decision": "无效的审核操作。",
};

type PageProps = {
  params: {
    taskId: string;
  };
  searchParams?: {
    success?: string;
    error?: string;
  };
};

export default async function AdminReviewDetailPage({ params, searchParams }: PageProps) {
  await requireRole("admin");

  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    include: {
      lecture: {
        select: {
          title: true,
          templatePath: true,
        },
      },
      assignee: {
        select: {
          name: true,
          username: true,
        },
      },
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: {
          id: true,
          submittedAt: true,
          commitSha: true,
          branchName: true,
          contentPath: true,
        },
      },
      reviewRecords: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          reviewer: {
            select: {
              name: true,
              username: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    return (
    <PageContainer title="审核任务不存在" badge="Review" wide>
        <AdminSectionNav />
        <EmptyState title="未找到审核任务" description="请返回审核列表重新选择任务。" />
      </PageContainer>
    );
  }

  const latestSubmission = task.submissions[0];
  const reviewAction = handleReviewDecisionAction.bind(null, task.id);
  const success = searchParams?.success ?? "";
  const error = searchParams?.error ? errorMessages[searchParams.error] ?? searchParams.error : "";
  const texFileName = getLectureTexFileName(task.lecture.templatePath);

  let diffError = "";
  let diffText = "暂无差异内容。";
  let branchMainTex = `当前任务分支中暂无 ${texFileName}。`;
  let mainBranchMainTex = `主分支中暂无 ${texFileName}。`;

  if (task.branchName) {
    try {
      const diffResult = await getTaskMainTexDiff({
        repoFilePath: task.lecture.templatePath,
        branchName: task.branchName,
      });
      diffText = diffResult.diffText;
      branchMainTex = diffResult.branchTexSource;
      mainBranchMainTex = diffResult.mainBranchTexSource;
    } catch (diffLoadError) {
      diffError =
        diffLoadError instanceof Error ? diffLoadError.message : "加载源码差异时发生未知错误。";
    }
  }

  return (
    <PageContainer
      title="任务审核"
      subtitle="左侧查看最新编译 PDF，右侧查看任务与提交信息，下方处理审核意见和分支合并。"
      badge="Review Detail"
      wide
      actions={
        <Link href="/admin/reviews" className="secondary-link-button">
          返回审核列表
        </Link>
      }
    >
      <AdminSectionNav />

      <section className="summary-banner">
        <div>
          <h2>{task.title}</h2>
          <p>
            {task.lecture.title} / {task.assignee.username}
          </p>
        </div>
        <span className="status-pill status-admin">{task.status}</span>
      </section>

      {success === "changes-requested" ? (
        <div className="feedback-banner success">已退回修改，老师可继续编辑后再次提交审核。</div>
      ) : null}
      {success === "merged" ? (
        <div className="feedback-banner success">已通过审核，任务分支内容已合并到主分支。</div>
      ) : null}
      {error ? <div className="feedback-banner error">{error}</div> : null}

      <section className="review-layout">
        <div className="review-preview">
          <section className="form-card">
            <div className="section-heading">
              <h3>编译 PDF</h3>
              <p>管理员可查看该任务最近一次成功编译生成的 PDF 预览。</p>
            </div>
            {task.lastCompileStatus === "SUCCESS" && task.lastPdfPath ? (
              <iframe
                title="审核 PDF 预览"
                src={`/api/teacher/tasks/${task.id}/pdf`}
                className="pdf-preview-frame"
              />
            ) : (
              <EmptyState
                title="暂无可预览 PDF"
                description="当前任务还没有最近一次成功编译生成的 PDF。"
              />
            )}
          </section>
        </div>

        <aside className="review-sidebar">
          <section className="detail-grid">
            <article className="detail-card">
              <h3>讲义名称</h3>
              <p>{task.lecture.title}</p>
            </article>
            <article className="detail-card">
              <h3>老师账号</h3>
              <p>
                {task.assignee.username}
              </p>
            </article>
            <article className="detail-card">
              <h3>任务状态</h3>
              <p>{task.status}</p>
            </article>
            <article className="detail-card">
              <h3>任务分支</h3>
              <p>{task.branchName || `task/${task.id}`}</p>
            </article>
            <article className="detail-card">
              <h3>最新提交 SHA</h3>
              <p>{latestSubmission?.commitSha ?? "暂无提交记录"}</p>
            </article>
            <article className="detail-card">
              <h3>最新提交时间</h3>
              <p>
                {latestSubmission
                  ? latestSubmission.submittedAt.toISOString().replace("T", " ").slice(0, 16)
                  : "暂无"}
              </p>
            </article>
            <article className="detail-card">
              <h3>讲义文件</h3>
              <p>{task.lecture.templatePath}</p>
            </article>
          </section>

          <section className="form-card">
            <div className="section-heading">
              <h3>审核处理</h3>
              <p>退回修改时必须填写审核意见；通过并合并会把任务分支合并到主分支。</p>
            </div>
            <form action={reviewAction} className="review-action-form">
              <label className="form-field">
                <span>审核意见</span>
                <textarea
                  name="comment"
                  rows={6}
                  placeholder="请输入审核意见；退回修改时为必填。"
                />
              </label>
              <div className="form-actions review-action-buttons">
                <button
                  type="submit"
                  name="decision"
                  value="changes_requested"
                  className="secondary-button"
                >
                  退回修改
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="approve_merge"
                  className="primary-button"
                >
                  通过并合并
                </button>
              </div>
            </form>
          </section>

          <section className="form-card">
            <div className="section-heading">
              <h3>最近审核记录</h3>
            </div>
            {task.reviewRecords.length === 0 ? (
              <EmptyState title="暂无审核记录" description="处理审核后，这里会显示最近的审核动作。" />
            ) : (
              <div className="review-list">
                {task.reviewRecords.map((record) => (
                  <div key={record.id} className="review-item">
                    <strong>{record.action}</strong>
                    <p>{record.comment || "暂无意见内容"}</p>
                    <span>
                      {record.reviewer.username} / {record.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>

      <section className="review-diff-grid">
        <section className="form-card">
          <div className="section-heading">
            <h3>{texFileName} 差异</h3>
            <p>对比当前任务分支与主分支对应 `{texFileName}` 的源码差异。</p>
          </div>
          {diffError ? (
            <div className="feedback-banner error">{diffError}</div>
          ) : (
            <div className="log-box">
              <pre>{diffText}</pre>
            </div>
          )}
        </section>

        <section className="detail-grid">
          <article className="form-card">
            <div className="section-heading">
              <h3>当前任务分支 {texFileName}</h3>
            </div>
            <div className="log-box">
              <pre>{branchMainTex}</pre>
            </div>
          </article>

          <article className="form-card">
            <div className="section-heading">
              <h3>主分支 {texFileName}</h3>
            </div>
            <div className="log-box">
              <pre>{mainBranchMainTex}</pre>
            </div>
          </article>
        </section>
      </section>
    </PageContainer>
  );
}
