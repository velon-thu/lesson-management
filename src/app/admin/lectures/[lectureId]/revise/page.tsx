import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { readRepoFileFromDefaultBranch } from "@/lib/gitea-submit";
import { getLectureTexFileName } from "@/lib/lecture-repo-path";
import { prisma } from "@/lib/prisma";
import LectureReviseEditor from "@/components/lecture-revise-editor";
import PageContainer from "@/components/page-container";

type PageProps = {
  params: {
    lectureId: string;
  };
};

export default async function AdminLectureRevisePage({ params }: PageProps) {
  await requireRole("admin");

  const lecture = await prisma.lecture.findUnique({
    where: { id: params.lectureId },
    select: { id: true, code: true, title: true, status: true, templatePath: true },
  });

  if (!lecture) {
    notFound();
  }

  if (lecture.status !== "DONE") {
    redirect("/admin/lectures");
  }

  let initialSource = "";
  let loadError = "";

  try {
    initialSource = await readRepoFileFromDefaultBranch(lecture.templatePath);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "无法读取讲义源码。";
  }

  const texFileName = getLectureTexFileName(lecture.templatePath);

  return (
    <PageContainer
      title={`修改讲义 ${lecture.code}`}
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
          <h2>{lecture.title}</h2>
          <p>讲义编号：{lecture.code}</p>
        </div>
        <span className="status-pill status-admin">{lecture.status}</span>
      </section>

      <LectureReviseEditor
        lectureId={lecture.id}
        texFileName={texFileName}
        initialSource={initialSource}
        loadError={loadError}
      />
    </PageContainer>
  );
}
