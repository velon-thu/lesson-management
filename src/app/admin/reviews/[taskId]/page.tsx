import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getLectureTexFileName } from "@/lib/lecture-repo-path";
import { prisma } from "@/lib/prisma";
import AdminSectionNav from "@/components/admin-section-nav";
import EmptyState from "@/components/empty-state";
import LectureReviseEditor from "@/components/lecture-revise-editor";
import PageContainer from "@/components/page-container";

type PageProps = {
  params: {
    taskId: string;
  };
};

export default async function AdminReviewDetailPage({ params }: PageProps) {
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
          username: true,
        },
      },
      draft: {
        select: {
          texSource: true,
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

  const texFileName = getLectureTexFileName(task.lecture.templatePath);

  return (
    <PageContainer
      title="任务审核"
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
            {task.lecture.title} / 提交老师：{task.assignee.username}
          </p>
        </div>
        <span className="status-pill status-admin">{task.status}</span>
      </section>

      <p className="form-hint">
        左侧查看并编辑 LaTeX 源码，右侧编译预览 PDF；确认无误后点「确认并合并到 Gitea」，
        内容会编译校验并提交到仓库主分支。
      </p>

      <LectureReviseEditor
        lecturePath={task.lecture.templatePath}
        texFileName={texFileName}
        initialSource={task.draft?.texSource ?? ""}
        compileEndpoint="/api/admin/lectures/compile-preview"
        submitEndpoint={`/api/admin/reviews/${task.id}/merge`}
        submitLabel="确认并合并到 Gitea"
        successRedirect="/admin/reviews?success=merged"
      />
    </PageContainer>
  );
}
