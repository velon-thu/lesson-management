import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { taskId: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录后再访问任务接口。" },
      { status: 401 }
    );
  }

  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    select: {
      id: true,
      title: true,
      createdById: true,
      assigneeId: true,
      branchName: true,
      status: true,
      lectureId: true,
    },
  });

  if (!task) {
    return NextResponse.json({ ok: false, error: "未找到对应任务。" }, { status: 404 });
  }

  if (user.role === "teacher" && task.assigneeId !== user.id) {
    return NextResponse.json(
      { ok: false, error: "你没有权限访问这个任务资源。" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    task,
    currentUser: {
      id: user.id,
      role: user.role,
      username: user.username,
    },
  });
}
