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
  const doneLectures = lectures.filter((lecture) => lecture.status === "DONE");
  const activeLectures = lectures.filter((lecture) => lecture.status !== "DONE");

  const successText = searchParams?.success
    ? searchParams.success === "deleted"
      ? "讲义已删除。"
      : "讲义已保存。"
    : "";
  const errorText = searchParams?.error
    ? searchParams.error === "missing"
      ? "操作失败：缺少必要参数。"
      : searchParams.error
    : "";

  return (
    <PageContainer title="讲义管理" wide hideHeader>
      <div className="page-header">
        <AdminSectionNav />
        <div className="page-actions">
          <Link href="/admin/lectures/new" className="primary-link-button">
            新建讲义
          </Link>
        </div>
      </div>

      {successText ? <div className="feedback-banner success">{successText}</div> : null}
      {errorText ? <div className="feedback-banner error">{errorText}</div> : null}

      <div className="lecture-block">
        <div className="block-title">
          <h2>未完成讲义</h2>
          <span className="count-pill">{activeLectures.length}</span>
        </div>
        {activeLectures.length === 0 ? (
          <EmptyState
            title="暂无未完成讲义"
            description="新建讲义后会出现在这里，等待分配与编写。"
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
                {activeLectures.map((lecture) => (
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
      </div>

      <div className="lecture-block">
        <div className="block-title">
          <h2>已完成讲义</h2>
          <span className="count-pill">{doneLectures.length}</span>
        </div>
        {doneLectures.length === 0 ? (
          <EmptyState
            title="暂无已完成讲义"
            description="讲义任务通过审核并合并到主分支后，会出现在这里。"
          />
        ) : (
          <form method="get" action="/api/admin/lectures/combine">
            <div className="table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>选择</th>
                    <th>编号</th>
                    <th>标题</th>
                    <th>仓库文件</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {doneLectures.map((lecture) => (
                    <tr key={lecture.id}>
                      <td>
                        <input type="checkbox" name="lectureId" value={lecture.id} />
                      </td>
                      <td>{lecture.code}</td>
                      <td>{lecture.title}</td>
                      <td>{lecture.templatePath}</td>
                      <td>
                        <Link
                          href={`/admin/lectures/${lecture.id}/revise`}
                          className="secondary-link-button compact-button"
                        >
                          修改
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="combine-bar">
              <span className="editor-action-hint">
                勾选多份已完成讲义，组合编译成一个 PDF 下载。
              </span>
              <button type="submit" className="primary-button">
                组合下载 PDF
              </button>
            </div>
          </form>
        )}
      </div>
    </PageContainer>
  );
}
