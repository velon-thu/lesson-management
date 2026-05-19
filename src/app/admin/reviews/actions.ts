"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LectureStatus, TaskStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { mergeTaskBranchToMain } from "@/lib/gitea-submit";
import { prisma } from "@/lib/prisma";

function buildReviewUrl(taskId: string, params?: Record<string, string>) {
  const url = new URL(`http://local/admin/reviews/${taskId}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}`;
}

export async function handleReviewDecisionAction(taskId: string, formData: FormData) {
  const admin = await requireRole("admin");
  const decision = String(formData.get("decision") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!task) {
    redirect("/admin/reviews");
  }

  const latestSubmission = task.submissions[0];

  if (!latestSubmission) {
    redirect(buildReviewUrl(taskId, { error: "missing-submission" }));
  }

  if (decision === "changes_requested") {
    if (!comment) {
      redirect(buildReviewUrl(taskId, { error: "comment-required" }));
    }

    await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.CHANGES_REQUESTED,
        },
      }),
      prisma.reviewRecord.create({
        data: {
          taskId: task.id,
          submissionId: latestSubmission.id,
          reviewerId: admin.id,
          action: "CHANGES_REQUESTED",
          comment,
        },
      }),
    ]);

    revalidatePath("/admin/reviews");
    revalidatePath(`/admin/reviews/${taskId}`);
    revalidatePath(`/teacher/tasks/${taskId}`);
    revalidatePath(`/teacher/tasks/${taskId}/edit`);
    redirect(buildReviewUrl(taskId, { success: "changes-requested" }));
  }

  if (decision === "approve_merge") {
    if (task.status === TaskStatus.MERGED || task.status === TaskStatus.COMPLETED) {
      redirect(buildReviewUrl(taskId, { error: "该任务已合并，无需重复操作。" }));
    }

    if (!task.branchName || !latestSubmission.commitSha) {
      redirect(buildReviewUrl(taskId, { error: "missing-branch" }));
    }

    let mergeError = "";

    try {
      const mergeResult = await mergeTaskBranchToMain({
        branchName: task.branchName,
        taskId: task.id,
      });

      await prisma.$transaction([
        prisma.task.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.MERGED,
          },
        }),
        prisma.lecture.update({
          where: { id: task.lectureId },
          data: {
            status: LectureStatus.DONE,
          },
        }),
        prisma.reviewRecord.create({
          data: {
            taskId: task.id,
            submissionId: latestSubmission.id,
            reviewerId: admin.id,
            action: "APPROVED_AND_MERGED",
            comment:
              comment ||
              `管理员已通过审核并合并到主分支，merge commit: ${mergeResult.mergeCommitSha.slice(0, 12)}。`,
          },
        }),
      ]);

      revalidatePath("/admin/reviews");
      revalidatePath("/admin/lectures");
      revalidatePath("/admin/tasks/assign");
      revalidatePath(`/admin/reviews/${taskId}`);
      revalidatePath(`/teacher/tasks/${taskId}`);
      revalidatePath(`/teacher/tasks/${taskId}/edit`);
    } catch (error) {
      mergeError = error instanceof Error ? error.message : "合并任务分支失败。";
    }

    // redirect 必须在 try/catch 之外调用，否则成功跳转的异常会被 catch 吞掉。
    if (mergeError) {
      redirect(buildReviewUrl(taskId, { error: mergeError }));
    }

    redirect(buildReviewUrl(taskId, { success: "merged" }));
  }

  redirect(buildReviewUrl(taskId, { error: "invalid-decision" }));
}
