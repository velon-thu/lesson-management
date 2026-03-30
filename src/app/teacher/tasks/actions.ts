"use server";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TaskStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { submitTaskToGiteaRepo } from "@/lib/gitea-submit";
import { compileLatexTask, COMPILE_STATUS } from "@/lib/latex";
import { uploadToMinio } from "@/lib/minio";
import { prisma } from "@/lib/prisma";
import { getOwnedTeacherTask } from "@/lib/teacher-task";

function buildTaskEditUrl(taskId: string, params?: Record<string, string>) {
  const url = new URL(`http://local/teacher/tasks/${taskId}/edit`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}`;
}

export async function saveTaskDraftAction(taskId: string, formData: FormData) {
  const user = await requireRole("teacher");
  const task = await getOwnedTeacherTask(taskId, user.id);
  const texSource = String(formData.get("texSource") ?? "");

  if (!task.draft) {
    redirect(buildTaskEditUrl(taskId, { error: "missing-draft" }));
  }

  await prisma.$transaction([
    prisma.taskDraft.update({
      where: { id: task.draft.id },
      data: {
        texSource,
      },
    }),
    prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        lastCompileStatus: COMPILE_STATUS.pending,
        lastCompileLog: "草稿已变更，请重新编译。",
        lastPdfPath: null,
      },
    }),
  ]);

  revalidatePath("/teacher/tasks");
  revalidatePath(`/teacher/tasks/${taskId}`);
  revalidatePath(`/teacher/tasks/${taskId}/edit`);
  redirect(buildTaskEditUrl(taskId, { success: "saved" }));
}

export async function submitTaskReviewAction(taskId: string) {
  const user = await requireRole("teacher");
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      lecture: {
        select: {
          code: true,
          title: true,
          templatePath: true,
        },
      },
      draft: {
        select: {
          id: true,
          texSource: true,
        },
      },
      assets: {
        orderBy: { createdAt: "desc" },
        select: {
          filePath: true,
        },
      },
    },
  });

  if (!task) {
    redirect("/forbidden");
  }

  if (task.assigneeId !== user.id) {
    redirect("/forbidden");
  }

  const texSource = task.draft?.texSource.trim() ?? "";

  if (!texSource) {
    redirect(buildTaskEditUrl(taskId, { error: "empty" }));
  }

  if (task.lastCompileStatus !== COMPILE_STATUS.success) {
    redirect(buildTaskEditUrl(taskId, { error: "compile-required" }));
  }

  try {
    const submission = await submitTaskToGiteaRepo({
      taskId: task.id,
      lectureCode: task.lecture.code,
      repoFilePath: task.lecture.templatePath,
      branchName: task.branchName || `task/${task.id}`,
      texSource,
      assets: task.assets,
    });

    await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.SUBMITTED,
          branchName: submission.branchName,
        },
      }),
      prisma.submission.create({
        data: {
          taskId: task.id,
          submittedById: user.id,
          status: "SUBMITTED",
          branchName: submission.branchName,
          commitSha: submission.commitSha,
          contentPath: submission.contentPath,
        },
      }),
      prisma.reviewRecord.create({
        data: {
          taskId: task.id,
          reviewerId: user.id,
          action: "SUBMIT_FOR_REVIEW",
          comment: `老师已提交 ${task.lecture.templatePath} 审核，提交分支 ${submission.branchName}，提交 SHA ${submission.commitSha.slice(0, 12)}。`,
        },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交审核失败，请稍后重试。";
    redirect(buildTaskEditUrl(taskId, { error: message }));
  }

  revalidatePath("/teacher/tasks");
  revalidatePath(`/teacher/tasks/${taskId}`);
  revalidatePath(`/teacher/tasks/${taskId}/edit`);
  redirect(buildTaskEditUrl(taskId, { success: "submitted" }));
}

export async function compilePreviewAction(taskId: string) {
  const user = await requireRole("teacher");
  const task = await getOwnedTeacherTask(taskId, user.id);

  if (!task.draft) {
    redirect(buildTaskEditUrl(taskId, { error: "missing-draft" }));
  }

  const result = await compileLatexTask({
    taskId: task.id,
    texSource: task.draft.texSource,
    entryFilePath: task.lecture.templatePath,
    assets: task.assets.map((asset) => ({
      filePath: asset.filePath,
    })),
  });

  await prisma.task.update({
    where: { id: task.id },
    data: {
      lastCompileStatus: result.status,
      lastCompileLog: result.log,
      lastPdfPath: result.pdfPath,
    },
  });

  revalidatePath("/teacher/tasks");
  revalidatePath(`/teacher/tasks/${taskId}`);
  revalidatePath(`/teacher/tasks/${taskId}/edit`);
  redirect(buildTaskEditUrl(taskId, { success: result.ok ? "compiled" : "compile-failed" }));
}

function sanitizeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const base = parsed.name.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").toLowerCase();
  const ext = parsed.ext || ".png";

  return `${base || "figure"}${ext.toLowerCase()}`;
}

export async function uploadTaskAssetAction(taskId: string, formData: FormData) {
  const user = await requireRole("teacher");
  const task = await getOwnedTeacherTask(taskId, user.id);
  const file = formData.get("asset");

  if (!(file instanceof File) || file.size === 0) {
    redirect(buildTaskEditUrl(taskId, { error: "file" }));
  }

  if (!file.type.startsWith("image/")) {
    redirect(buildTaskEditUrl(taskId, { error: "image-only" }));
  }

  const safeFileName = sanitizeFileName(file.name);
  const key = `assets/${taskId}/${randomUUID()}-${safeFileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadToMinio({
      key,
      body: buffer,
      contentType: file.type,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    redirect(buildTaskEditUrl(taskId, { error: message }));
  }

  await prisma.asset.create({
    data: {
      lectureId: task.lectureId,
      taskId: task.id,
      taskDraftId: task.draftId,
      uploadedById: user.id,
      fileName: file.name,
      filePath: key,
      mimeType: file.type,
    },
  });

  await prisma.task.update({
    where: { id: task.id },
    data: {
      lastCompileStatus: COMPILE_STATUS.pending,
      lastCompileLog: "素材已变更，请重新编译。",
      lastPdfPath: null,
    },
  });
  revalidatePath(`/teacher/tasks/${taskId}`);
  revalidatePath(`/teacher/tasks/${taskId}/edit`);
  redirect(
    buildTaskEditUrl(taskId, {
      success: "uploaded",
      snippet: `\\includegraphics[width=0.8\\textwidth]{${key}}`,
    })
  );
}
