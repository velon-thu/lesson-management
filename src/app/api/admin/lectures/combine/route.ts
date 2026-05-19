import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { combineLecturesBooklet } from "@/lib/gitea-submit";
import { normalizeLectureRepoFilePath } from "@/lib/lecture-repo-path";

/**
 * 组合多份讲义为一本「讲义合集」PDF 并下载。
 * 以 multipart/form-data 提交：cover 为可选的封面 PDF 文件，
 * config 为 JSON 字符串 { headerText, chapters: [{ path, title }] }。
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "未登录或无权限。" }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  let config: { headerText?: unknown; chapters?: unknown };

  try {
    config = JSON.parse(String(formData.get("config") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "组合配置格式不正确。" }, { status: 400 });
  }

  const headerText = typeof config.headerText === "string" ? config.headerText : "";
  const rawChapters = Array.isArray(config.chapters) ? config.chapters : [];

  if (rawChapters.length === 0) {
    return NextResponse.json({ error: "请至少选择一份讲义。" }, { status: 400 });
  }

  const chapters: Array<{ path: string; title: string }> = [];

  for (const item of rawChapters) {
    try {
      const path = normalizeLectureRepoFilePath(String((item as { path?: unknown })?.path ?? ""));
      const title = String((item as { title?: unknown })?.title ?? "");
      chapters.push({ path, title });
    } catch {
      return NextResponse.json({ error: "讲义路径不合法。" }, { status: 400 });
    }
  }

  let coverPdf: Buffer | null = null;
  const cover = formData.get("cover");

  if (cover instanceof File && cover.size > 0) {
    if (cover.type !== "application/pdf" && !cover.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "封面必须是 PDF 文件。" }, { status: 400 });
    }
    coverPdf = Buffer.from(await cover.arrayBuffer());
  }

  try {
    const pdf = await combineLecturesBooklet({ chapters, headerText, coverPdf });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="lecture-booklet.pdf"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "组合下载失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
