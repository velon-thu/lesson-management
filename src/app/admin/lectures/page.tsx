import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { deleteLectureAction } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";
import AdminSectionNav from "@/components/admin-section-nav";
import EmptyState from "@/components/empty-state";
import PageContainer from "@/components/page-container";

type PageProps = {
  searchParams?: {
    success?: string;
    error?: string;
  };
};

export default async function AdminLecturesPage({ searchParams }: PageProps) {
  await requireRole("admin");

  const lectures = await prisma.lecture.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageContainer
      title="讲义管理"
      wide
      hideHeader
    >
      <div className="page-header">
        <AdminSectionNav />
        <div className="page-actions">
          <Link href="/admin/lectures/new" className="primary-link-button">
            新建讲义
          </Link>
        </div>
      </div>

      {searchParams?.success ? (
        <div className="feedback-banner success">
          {searchParams.success === "deleted" ? "讲义已删除。" : "讲义已保存。"}
        </div>
      ) : null}
      {searchParams?.error ? <div className="feedback-banner error">删除讲义失败。</div> : null}

      {lectures.length === 0 ? (
        <EmptyState
          title="暂无讲义"
          description="先创建第一条讲义记录，后续才能继续做任务分配。"
        />
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>标题</th>
                <th>讲义描述</th>
                <th>截止日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {lectures.map((lecture) => (
                <tr key={lecture.id}>
                  <td>{lecture.code}</td>
                  <td>{lecture.title}</td>
                  <td>{lecture.description?.trim() || "-"}</td>
                  <td>{lecture.deadline ? lecture.deadline.toISOString().slice(0, 10) : "-"}</td>
                  <td>{lecture.status}</td>
                  <td>
                    <div className="table-actions">
                      <Link
                        href={`/admin/lectures/new?id=${lecture.id}`}
                        className="secondary-link-button compact-button"
                      >
                        编辑
                      </Link>
                      <Link
                        href={`/admin/tasks/assign?lectureId=${lecture.id}`}
                        className="secondary-link-button compact-button"
                      >
                        分配
                      </Link>
                      <form action={deleteLectureAction}>
                        <input type="hidden" name="lectureId" value={lecture.id} />
                        <button type="submit" className="secondary-button compact-button">
                          删除
                        </button>
                      </form>
                    </div>
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
