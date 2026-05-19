import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { LectureStatus, TaskStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { reviseLectureOnMain } from "@/lib/gitea-submit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    taskId: string;
  };
};

/**
 * 管理员审核确认并合并：把（管理员可能已编辑过的）讲义内容直接提交到 Gitea
 * 主分支，编译校验通过后把任务标记为 MERGED、讲义标记为 DONE。
 */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "未登录或无权限。" }, { status: 401 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    include: {
      lecture: { select: { id: true, templatePath: true } },
      submissions: { orderBy: { submittedAt: "desc" }, take: 1, select: { id: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ ok: false, error: "未找到对应任务。" }, { status: 404 });
  }

  if (task.status === TaskStatus.MERGED || task.status === TaskStatus.COMPLETED) {
    return NextResponse.json({ ok: false, error: "该任务已合并，无需重复操作。" });
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
      templatePath: task.lecture.templatePath,
      content: texSource,
    });

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: "编译未通过，已阻止合并，请根据日志修正后重试。",
        log: result.log,
      });
    }

    const latestSubmission = task.submissions[0];

    await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.MERGED } }),
      prisma.lecture.update({ where: { id: task.lectureId }, data: { status: LectureStatus.DONE } }),
      prisma.reviewRecord.create({
        data: {
          taskId: task.id,
          submissionId: latestSubmission?.id ?? null,
          reviewerId: user.id,
          action: "APPROVED_AND_MERGED",
          comment: "管理员审核通过并合并到 Gitea 主分支。",
        },
      }),
      // 把管理员最终确认的内容同步回草稿，保持数据库与仓库一致。
      ...(task.draftId
        ? [prisma.taskDraft.update({ where: { id: task.draftId }, data: { texSource } })]
        : []),
    ]);

    revalidatePath("/admin/reviews");
    revalidatePath("/admin/lectures");
    revalidatePath("/teacher/tasks");

    return NextResponse.json({ ok: true, log: result.log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "合并失败。";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
