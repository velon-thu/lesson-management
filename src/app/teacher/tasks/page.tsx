import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";

export default async function TeacherTasksPage() {
  const user = await requireRole("teacher");

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: user.id,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      lecture: {
        select: {
          title: true,
        },
      },
      draft: {
        select: {
          updatedAt: true,
        },
      },
    },
  });

  return (
    <PageContainer
      title="我的任务"
      badge="My Tasks"
      wide
    >
      {tasks.length === 0 ? (
        <EmptyState
          title="暂无任务"
          description="当前还没有分配给你的任务，等待管理员创建并分发。"
        />
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>任务标题</th>
                <th>所属讲义</th>
                <th>最近更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const updatedAt = task.draft?.updatedAt ?? task.updatedAt;

                return (
                  <tr key={task.id}>
                    <td>{task.title}</td>
                    <td>{task.lecture.title}</td>
                    <td>{updatedAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                    <td>
                      <div className="table-actions">
                        <Link
                          href={`/teacher/tasks/${task.id}`}
                          className="secondary-link-button compact-button"
                        >
                          任务详情
                        </Link>
                        <Link
                          href={`/teacher/tasks/${task.id}/edit`}
                          className="secondary-link-button compact-button"
                        >
                          去编辑
                        </Link>
                      </div>
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
