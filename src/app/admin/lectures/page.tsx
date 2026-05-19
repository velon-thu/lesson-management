import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { deleteLectureAction } from "@/app/admin/actions";
import { listRepoLectureFiles } from "@/lib/gitea-submit";
import { prisma } from "@/lib/prisma";
import AdminSectionNav from "@/components/admin-section-nav";
import EmptyState from "@/components/empty-state";
import LectureTree from "@/components/lecture-tree";
import PageContainer from "@/components/page-container";

type PageProps = {
  searchParams?: {
    success?: string;
    error?: string;
  };
};

export default async function AdminLecturesPage({ searchParams }: PageProps) {
  await requireRole("admin");

  const activeLectures = await prisma.lecture.findMany({
    where: { status: { not: "DONE" } },
    orderBy: { createdAt: "desc" },
  });

  let lectureFiles: string[] = [];
  let repoError = "";

  try {
    lectureFiles = await listRepoLectureFiles();
  } catch (error) {
    repoError = error instanceof Error ? error.message : "无法读取 Gitea 仓库的讲义列表。";
  }

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
          <h2>已有讲义</h2>
          <span className="count-pill">{lectureFiles.length}</span>
          {lectureFiles.length > 0 ? (
            <Link
              href="/admin/lectures/combine"
              className="secondary-link-button compact-button combine-entry-link"
            >
              组合下载讲义
            </Link>
          ) : null}
        </div>
        <p className="form-hint">来源为 Gitea 仓库主分支，按文件夹层级展示。</p>
        {repoError ? (
          <div className="feedback-banner error">{repoError}</div>
        ) : lectureFiles.length === 0 ? (
          <EmptyState
            title="仓库中暂无讲义"
            description="讲义任务通过审核合并、或仓库里有 .tex 文件后，会出现在这里。"
          />
        ) : (
          <div className="table-card">
            <LectureTree files={lectureFiles} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
