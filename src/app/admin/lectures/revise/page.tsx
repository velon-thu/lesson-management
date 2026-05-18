import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { readRepoFileFromDefaultBranch } from "@/lib/gitea-submit";
import { getLectureTexFileName, normalizeLectureRepoFilePath } from "@/lib/lecture-repo-path";
import LectureReviseEditor from "@/components/lecture-revise-editor";
import PageContainer from "@/components/page-container";

type PageProps = {
  searchParams?: {
    path?: string;
  };
};

export default async function AdminLectureRevisePage({ searchParams }: PageProps) {
  await requireRole("admin");

  const rawPath = searchParams?.path?.trim() ?? "";
  let safePath = "";

  try {
    safePath = normalizeLectureRepoFilePath(rawPath);
  } catch {
    redirect("/admin/lectures");
  }

  let initialSource = "";
  let loadError = "";

  try {
    initialSource = await readRepoFileFromDefaultBranch(safePath);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "无法读取讲义源码。";
  }

  const texFileName = getLectureTexFileName(safePath);

  return (
    <PageContainer
      title={`修改讲义 ${texFileName}`}
      badge="Revise"
      wide
      actions={
        <Link href="/admin/lectures" className="secondary-link-button">
          返回讲义管理
        </Link>
      }
    >
      <section className="summary-banner">
        <div>
          <h2>{texFileName}</h2>
          <p>仓库路径：{safePath}</p>
        </div>
        <span className="status-pill status-admin">已有讲义</span>
      </section>

      <LectureReviseEditor
        lecturePath={safePath}
        texFileName={texFileName}
        initialSource={initialSource}
        loadError={loadError}
      />
    </PageContainer>
  );
}
