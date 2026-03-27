import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSectionNav from "@/components/admin-section-nav";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";

export default async function AdminTeachersPage() {
  await requireRole("admin");

  const teachers = await prisma.user.findMany({
    where: {
      role: UserRole.TEACHER,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          assignedTasks: true,
        },
      },
    },
  });

  return (
    <PageContainer
      title="老师列表"
      subtitle="查看当前可分配任务的老师账号，并从这里快速进入任务分配流程。"
      badge="Teachers"
    >
      <AdminSectionNav />

      {teachers.length === 0 ? (
        <EmptyState
          title="暂无老师账号"
          description="当前还没有可分配任务的老师用户。"
        />
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>姓名</th>
                <th>邮箱</th>
                <th>已分配任务</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>{teacher.username}</td>
                  <td>{teacher.name}</td>
                  <td>{teacher.email}</td>
                  <td>{teacher._count.assignedTasks}</td>
                  <td>
                    <Link
                      href={`/admin/tasks/assign?teacherId=${teacher.id}`}
                      className="secondary-link-button compact-button"
                    >
                      分配任务
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
