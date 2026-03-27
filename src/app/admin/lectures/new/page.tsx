import Link from "next/link";
import { LectureStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveLectureAction } from "@/app/admin/actions";
import AdminSectionNav from "@/components/admin-section-nav";
import PageContainer from "@/components/page-container";
import SubmitButton from "@/components/submit-button";

type PageProps = {
  searchParams?: {
    id?: string;
    error?: string;
  };
};

export default async function AdminLectureFormPage({ searchParams }: PageProps) {
  await requireRole("admin");

  const lecture = searchParams?.id
    ? await prisma.lecture.findUnique({
        where: { id: searchParams.id },
      })
    : null;

  return (
    <PageContainer
      title={lecture ? "编辑讲义" : "新建讲义"}
      subtitle="录入讲义基础信息，保存后即可在讲义列表里查看或继续分配任务。"
      badge="Lecture Form"
      actions={
        <Link href="/admin/lectures" className="secondary-link-button">
          返回列表
        </Link>
      }
    >
      <AdminSectionNav />

      {searchParams?.error ? (
        <div className="feedback-banner error">请完整填写编号、标题、章节和模板路径。</div>
      ) : null}

      <section className="form-card">
        <form action={saveLectureAction} className="admin-form-grid">
          <input type="hidden" name="lectureId" value={lecture?.id ?? ""} />

          <label className="form-field">
            <span>讲义编号 code</span>
            <input
              name="code"
              type="text"
              defaultValue={lecture?.code ?? ""}
              placeholder="例如：L01"
            />
          </label>

          <label className="form-field">
            <span>讲义标题 title</span>
            <input
              name="title"
              type="text"
              defaultValue={lecture?.title ?? ""}
              placeholder="例如：第 1 讲"
            />
          </label>

          <label className="form-field">
            <span>章节 chapter</span>
            <input
              name="chapter"
              type="text"
              defaultValue={lecture?.chapter ?? ""}
              placeholder="例如：函数基础"
            />
          </label>

          <label className="form-field">
            <span>截止日期 deadline</span>
            <input
              name="deadline"
              type="date"
              defaultValue={lecture?.deadline?.toISOString().slice(0, 10) ?? ""}
            />
          </label>

          <label className="form-field form-field-full">
            <span>模板路径 templatePath</span>
            <input
              name="templatePath"
              type="text"
              defaultValue={lecture?.templatePath ?? ""}
              placeholder="例如：templates/chapter/main.tex"
            />
          </label>

          <label className="form-field form-field-full">
            <span>描述 description</span>
            <textarea
              name="description"
              rows={4}
              defaultValue={lecture?.description ?? ""}
              placeholder="简要描述本讲义内容"
            />
          </label>

          <label className="form-field">
            <span>状态 status</span>
            <select name="status" defaultValue={lecture?.status ?? LectureStatus.DRAFT}>
              <option value={LectureStatus.DRAFT}>DRAFT</option>
              <option value={LectureStatus.ACTIVE}>ACTIVE</option>
              <option value={LectureStatus.ARCHIVED}>ARCHIVED</option>
            </select>
          </label>

          <div className="form-actions form-field-full">
            <SubmitButton
              idleText={lecture ? "保存修改" : "创建讲义"}
              pendingText={lecture ? "保存中..." : "创建中..."}
              className="primary-button"
            />
          </div>
        </form>
      </section>
    </PageContainer>
  );
}
