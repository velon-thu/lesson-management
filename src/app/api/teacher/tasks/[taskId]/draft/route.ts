import { NextResponse } from "next/server";
import { TaskStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { COMPILE_STATUS } from "@/lib/latex";
import { prisma } from "@/lib/prisma";
import { findOwnedTeacherTask } from "@/lib/teacher-task";

type RouteContext = {
  params: {
    taskId: string;
  };
};

/**
 * 保存讲义草稿（自动保存 / Ctrl+S 调用），不触发编译。
 * 标记为待重新编译，但保留上一次成功编译的 PDF，便于继续预览。
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "未登录或无权限。" }, { status: 401 });
  }

  const task = await findOwnedTeacherTask(params.taskId, user.id);

  if (!task) {
    return NextResponse.json({ error: "任务不存在或不属于你。" }, { status: 403 });
  }

  if (!task.draft) {
    return NextResponse.json({ error: "当前任务没有可写入的草稿记录。" }, { status: 400 });
  }

  let texSource = "";

  try {
    const body = await request.json();
    texSource = String(body?.texSource ?? "");
  } catch {
    return NextResponse.json({ error: "请求体格式不正确。" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.taskDraft.update({
      where: { id: task.draft.id },
      data: { texSource },
    }),
    prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        lastCompileStatus: COMPILE_STATUS.pending,
        lastCompileLog: "草稿已变更，请重新编译。",
      },
    }),
  ]);

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
