import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignTaskAction } from "@/app/admin/actions";
import AdminSectionNav from "@/components/admin-section-nav";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";
import SubmitButton from "@/components/submit-button";

type PageProps = {
  searchParams?: {
    lectureId?: string;
    teacherId?: string;
    success?: string;
    error?: string;
  };
};

export default async function AdminTaskAssignPage({ searchParams }: PageProps) {
  await requireRole("admin");

  const [lectures, teachers, tasks] = await Promise.all([
    prisma.lecture.findMany({
      orderBy: [{ status: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        chapter: true,
        status: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: "TEACHER",
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        name: true,
      },
    }),
    prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        branchName: true,
        status: true,
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
      },
    }),
  ]);

  const canAssign = lectures.length > 0 && teachers.length > 0;

  return (
    <PageContainer
      title="任务分配"
      subtitle="选择讲义和老师后，系统会自动创建 task、生成默认分支名，并初始化 main.tex 到 task_drafts.tex_source。"
      badge="Assign Task"
    >
      <AdminSectionNav />

      {searchParams?.success ? (
        <div className="feedback-banner success">任务已分配，初始草稿也已生成。</div>
      ) : null}
      {searchParams?.error ? (
        <div className="feedback-banner error">请选择讲义和老师后再提交。</div>
      ) : null}

      {!canAssign ? (
        <EmptyState
          title="暂时无法分配任务"
          description="请先准备至少一条讲义记录和一个老师账号。"
        />
      ) : (
        <section className="form-card">
          <form action={assignTaskAction} className="admin-form-grid">
            <label className="form-field">
              <span>选择讲义</span>
              <select name="lectureId" defaultValue={searchParams?.lectureId ?? ""}>
                <option value="">请选择讲义</option>
                {lectures.map((lecture) => (
                  <option key={lecture.id} value={lecture.id}>
                    {lecture.code} / {lecture.title} / {lecture.chapter}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>选择老师</span>
              <select name="teacherId" defaultValue={searchParams?.teacherId ?? ""}>
                <option value="">请选择老师</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.username})
                  </option>
                ))}
              </select>
            </label>

            <div className="form-actions form-field-full">
              <SubmitButton
                idleText="创建并分配任务"
                pendingText="分配中..."
                className="primary-button"
              />
            </div>
          </form>
        </section>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          title="暂无任务记录"
          description="分配第一条任务后，这里会展示最近任务。"
        />
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>任务标题</th>
                <th>讲义</th>
                <th>老师</th>
                <th>分支名</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>
                    {task.lecture.code} / {task.lecture.title}
                  </td>
                  <td>
                    {task.assignee.name} ({task.assignee.username})
                  </td>
                  <td>{task.branchName}</td>
                  <td>{task.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
