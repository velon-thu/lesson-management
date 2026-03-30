import Link from "next/link";
import { TaskStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSectionNav from "@/components/admin-section-nav";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";

export default async function AdminReviewsPage() {
  await requireRole("admin");

  const tasks = await prisma.task.findMany({
    where: {
      status: {
        in: [TaskStatus.SUBMITTED, TaskStatus.CHANGES_REQUESTED],
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      lecture: {
        select: {
          code: true,
          title: true,
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
          submittedAt: true,
          commitSha: true,
        },
      },
    },
  });

  return (
    <PageContainer
      title="审核列表"
      wide
      hideHeader
    >
      <div className="page-header">
        <AdminSectionNav />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="暂无审核任务"
          description="当前没有处于待审核状态的任务，老师提交后会出现在这里。"
        />
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>讲义名称</th>
                <th>老师账号</th>
                <th>最新提交时间</th>
                <th>当前状态</th>
                <th>最新提交</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const latestSubmission = task.submissions[0];

                return (
                  <tr key={task.id}>
                    <td>
                      {task.lecture.code} / {task.lecture.title}
                    </td>
                    <td>
                      {task.assignee.username}
                    </td>
                    <td>
                      {latestSubmission
                        ? latestSubmission.submittedAt.toISOString().replace("T", " ").slice(0, 16)
                        : "暂无"}
                    </td>
                    <td>{task.status}</td>
                    <td>{latestSubmission?.commitSha?.slice(0, 12) ?? "暂无"}</td>
                    <td>
                      <Link
                        href={`/admin/reviews/${task.id}`}
                        className="secondary-link-button compact-button"
                      >
                        进入审核
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
