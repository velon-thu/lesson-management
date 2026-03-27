import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { downloadFromMinio } from "@/lib/minio";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    taskId: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "请先登录后再查看 PDF 预览。" }, { status: 401 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    select: {
      id: true,
      assigneeId: true,
      lastPdfPath: true,
      lastCompileStatus: true,
    },
  });

  if (!task) {
    return NextResponse.json({ ok: false, error: "未找到对应任务。" }, { status: 404 });
  }

  if (user.role === "teacher" && task.assigneeId !== user.id) {
    return NextResponse.json({ ok: false, error: "你没有权限查看这个 PDF。" }, { status: 403 });
  }

  if (!task.lastPdfPath || task.lastCompileStatus !== "SUCCESS") {
    return NextResponse.json({ ok: false, error: "当前没有可预览的 PDF。" }, { status: 404 });
  }

  const pdf = await downloadFromMinio(task.lastPdfPath);

  return new NextResponse(pdf.body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "inline; filename=\"preview.pdf\"",
      "cache-control": "no-store",
    },
  });
}
