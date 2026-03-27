import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getOwnedTeacherTask } from "@/lib/teacher-task";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";
import TeacherSectionNav from "@/components/teacher-section-nav";

type PageProps = {
  params: {
    taskId: string;
  };
};

export default async function TeacherTaskDetailPage({ params }: PageProps) {
  const user = await requireRole("teacher");
  const task = await getOwnedTeacherTask(params.taskId, user.id);
  const updatedAt = task.draft?.updatedAt ?? task.updatedAt;

  return (
    <PageContainer
      title="任务详情"
      subtitle="查看任务基础信息、所属讲义、状态与最近更新时间，然后进入编辑页处理 main.tex。"
      badge="Task Detail"
      actions={
        <Link href={`/teacher/tasks/${task.id}/edit`} className="primary-link-button">
          进入编辑页
        </Link>
      }
    >
      <TeacherSectionNav />

      <section className="summary-banner">
        <div>
          <h2>{task.title}</h2>
          <p>
            所属讲义：{task.lecture.code} / {task.lecture.title} / {task.lecture.chapter}
          </p>
        </div>
        <span className="status-pill status-teacher">{task.status}</span>
      </section>

      <section className="detail-grid">
        <article className="detail-card">
          <h3>任务标题</h3>
          <p>{task.title}</p>
        </article>
        <article className="detail-card">
          <h3>所属讲义</h3>
          <p>
            {task.lecture.code} / {task.lecture.title}
          </p>
        </article>
        <article className="detail-card">
          <h3>当前状态</h3>
          <p>{task.status}</p>
        </article>
        <article className="detail-card">
          <h3>最近更新时间</h3>
          <p>{updatedAt.toISOString().replace("T", " ").slice(0, 16)}</p>
        </article>
      </section>

      {task.reviewRecords.length === 0 ? (
        <EmptyState
          title="暂无审核意见"
          description="当前任务还没有新的审核记录，提交审核后会在这里看到最新状态。"
        />
      ) : (
        <section className="tips-panel">
          <h3>最近审核意见</h3>
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
        </section>
      )}
    </PageContainer>
  );
}
