import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getLectureTexFileName, getLectureRepoFolder } from "@/lib/lecture-repo-path";
import { getOwnedTeacherTask } from "@/lib/teacher-task";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";

type PageProps = {
  params: {
    taskId: string;
  };
};

export default async function TeacherTaskDetailPage({ params }: PageProps) {
  const user = await requireRole("teacher");
  const task = await getOwnedTeacherTask(params.taskId, user.id);
  const updatedAt = task.draft?.updatedAt ?? task.updatedAt;
  const texFileName = getLectureTexFileName(task.lecture.templatePath);
  const repoFolder = getLectureRepoFolder(task.lecture.templatePath);

  return (
    <PageContainer
      title="任务详情"
      badge="Task Detail"
      wide
      actions={
        <Link href="/teacher/tasks" className="secondary-link-button">
          返回任务列表
        </Link>
      }
    >
      <section className="summary-banner">
        <div>
          <h2>{task.title}</h2>
          <p>所属讲义：{task.lecture.title}</p>
        </div>
        <span className="status-pill status-teacher">{texFileName}</span>
      </section>

      <section className="detail-grid">
        <article className="detail-card">
          <h3>任务标题</h3>
          <p>{task.title}</p>
        </article>
        <article className="detail-card">
          <h3>所属讲义</h3>
          <p>{task.lecture.title}</p>
        </article>
        <article className="detail-card">
          <h3>讲义文件</h3>
          <p>{task.lecture.templatePath}</p>
        </article>
        <article className="detail-card">
          <h3>所在文件夹</h3>
          <p>{repoFolder || "仓库根目录"}</p>
        </article>
        <article className="detail-card">
          <h3>讲义描述</h3>
          <p>{task.lecture.description?.trim() || "暂无讲义描述"}</p>
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
                {record.reviewer.username} / {record.createdAt.toISOString().replace("T", " ").slice(0, 16)}
              </span>
            </div>
          ))}
        </section>
      )}
    </PageContainer>
  );
}
