import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listRepoLectureFiles } from "@/lib/gitea-submit";
import CombineConfig from "@/components/combine-config";
import PageContainer from "@/components/page-container";

export default async function AdminCombinePage() {
  await requireRole("admin");

  let files: string[] = [];
  let repoError = "";

  try {
    files = await listRepoLectureFiles();
  } catch (error) {
    repoError = error instanceof Error ? error.message : "无法读取 Gitea 仓库的讲义列表。";
  }

  return (
    <PageContainer
      title="组合下载讲义"
      badge="Combine"
      wide
      actions={
        <Link href="/admin/lectures" className="secondary-link-button">
          返回讲义管理
        </Link>
      }
    >
      {repoError ? (
        <div className="feedback-banner error">{repoError}</div>
      ) : (
        <CombineConfig files={files} />
      )}
    </PageContainer>
  );
}
