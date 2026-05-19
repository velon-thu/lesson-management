import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { compileLecturePreview } from "@/lib/gitea-submit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    taskId: string;
  };
};

/**
 * 审核页的编译预览：编译管理员当前编辑的讲义内容，并从 MinIO 带上该任务的
 * 图片素材（任务尚未合并，素材还不在仓库主分支上）。不提交任何改动。
 */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "未登录或无权限。" }, { status: 401 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    include: {
      lecture: { select: { templatePath: true } },
      assets: { select: { filePath: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ ok: false, error: "未找到对应任务。" }, { status: 404 });
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
      templatePath: task.lecture.templatePath,
      content: texSource,
      assets: task.assets,
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
