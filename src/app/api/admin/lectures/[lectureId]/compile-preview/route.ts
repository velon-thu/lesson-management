import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { compileLecturePreview } from "@/lib/gitea-submit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    lectureId: string;
  };
};

/**
 * 编译预览已完成讲义的修改稿，不提交任何改动。
 * 返回编译日志，成功时附带 base64 编码的 PDF 供编辑器原地预览。
 */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "未登录或无权限。" }, { status: 401 });
  }

  const lecture = await prisma.lecture.findUnique({
    where: { id: params.lectureId },
    select: { id: true, templatePath: true },
  });

  if (!lecture) {
    return NextResponse.json({ ok: false, error: "未找到对应讲义。" }, { status: 404 });
  }

  let texSource = "";

  try {
    const body = await request.json();
    texSource = String(body?.texSource ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "请求体格式不正确。" }, { status: 400 });
  }

  try {
    const result = await compileLecturePreview({
      templatePath: lecture.templatePath,
      content: texSource,
    });

    return NextResponse.json({
      ok: result.ok,
      log: result.log,
      pdf: result.pdf ? result.pdf.toString("base64") : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "编译预览失败。";
    return NextResponse.json({ ok: false, log: message, pdf: null }, { status: 500 });
  }
}
