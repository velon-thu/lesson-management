import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reviseLectureOnMain } from "@/lib/gitea-submit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    lectureId: string;
  };
};

/**
 * 修改已完成讲义并轻量发布：先编译校验，通过才直接提交到仓库主分支。
 */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "未登录或无权限。" }, { status: 401 });
  }

  const lecture = await prisma.lecture.findUnique({
    where: { id: params.lectureId },
    select: { id: true, status: true, templatePath: true },
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

  if (!texSource.trim()) {
    return NextResponse.json({ ok: false, error: "讲义内容不能为空。" }, { status: 400 });
  }

  try {
    const result = await reviseLectureOnMain({
      templatePath: lecture.templatePath,
      content: texSource,
    });

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: "编译未通过，已阻止发布，请根据日志修正后重试。",
        log: result.log,
      });
    }

    return NextResponse.json({ ok: true, log: result.log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发布修改失败。";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
