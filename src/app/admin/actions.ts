"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LectureStatus, TaskStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { repoFileExistsInDefaultBranch } from "@/lib/gitea-submit";
import { buildLectureRepoFilePath } from "@/lib/lecture-repo-path";
import { prisma } from "@/lib/prisma";
import { buildInitialTexSource } from "@/lib/task-template";

function normalizeDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  return new Date(`${raw}T23:59:59.000Z`);
}

export async function saveLectureAction(formData: FormData) {
  const user = await requireRole("admin");
  const lectureId = String(formData.get("lectureId") ?? "").trim();
  const existingLecture = lectureId
    ? await prisma.lecture.findUnique({
        where: { id: lectureId },
        select: {
          status: true,
          chapter: true,
          templatePath: true,
        },
      })
    : null;
  const payload = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    deadline: normalizeDate(formData.get("deadline")),
    chapter: existingLecture?.chapter ?? "未分配章节",
    templatePath: existingLecture?.templatePath ?? "templates/chapter/main.tex",
    status: existingLecture?.status ?? LectureStatus.TODO,
    createdById: user.id,
  };

  if (!payload.title) {
    redirect("/admin/lectures/new?error=missing");
  }

  if (lectureId) {
    await prisma.lecture.update({
      where: { id: lectureId },
      data: payload,
    });
  } else {
    await prisma.lecture.create({
      data: payload,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/lectures");
  revalidatePath("/admin/tasks/assign");
  redirect("/admin/lectures?success=1");
}

export async function deleteLectureAction(formData: FormData) {
  await requireRole("admin");

  const lectureId = String(formData.get("lectureId") ?? "").trim();

  if (!lectureId) {
    redirect("/admin/lectures?error=missing");
  }

  await prisma.lecture.delete({
    where: { id: lectureId },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/lectures");
  revalidatePath("/admin/tasks/assign");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/reviews");
  revalidatePath("/teacher/tasks");
  redirect("/admin/lectures?success=deleted");
}

export async function assignTaskAction(formData: FormData) {
  const admin = await requireRole("admin");
  const lectureId = String(formData.get("lectureId") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const repoFolder = String(formData.get("repoFolder") ?? "").trim();
  const texFileName = String(formData.get("texFileName") ?? "").trim();

  if (!lectureId || !teacherId || !texFileName) {
    redirect("/admin/tasks/assign?error=missing");
  }

  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: {
      id: true,
      title: true,
      chapter: true,
      description: true,
      templatePath: true,
      status: true,
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  });

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: UserRole.TEACHER, isActive: true },
    select: { id: true, username: true },
  });

  if (!lecture || !teacher) {
    redirect("/admin/tasks/assign?error=invalid");
  }

  if (lecture.status !== LectureStatus.TODO || lecture._count.tasks > 0) {
    redirect("/admin/tasks/assign?error=assigned");
  }

  let repoFilePath = "";

  try {
    repoFilePath = buildLectureRepoFilePath(repoFolder, texFileName);
  } catch (error) {
    const message = error instanceof Error ? error.message : "讲义仓库路径不合法。";
    redirect(`/admin/tasks/assign?error=${encodeURIComponent(message)}`);
  }

  if (await repoFileExistsInDefaultBranch(repoFilePath)) {
    redirect("/admin/tasks/assign?error=exists");
  }

  const taskId = randomUUID();
  const branchName = `task/${taskId}`;
  const texSource = buildInitialTexSource({
    taskId,
    teacherName: teacher.username || "teacher",
    lecture,
  });

  await prisma.$transaction(async (tx) => {
    const draft = await tx.taskDraft.create({
      data: {
        lectureId: lecture.id,
        createdById: admin.id,
        title: `${lecture.title} 初始稿`,
        texSource,
      },
    });

    await tx.task.create({
      data: {
        id: taskId,
        title: `${lecture.title} - ${teacher.username || "teacher"}`,
        lectureId: lecture.id,
        draftId: draft.id,
        createdById: admin.id,
        assigneeId: teacher.id,
        branchName,
        status: TaskStatus.ASSIGNED,
        compiler: "xelatex",
      },
    });

    await tx.lecture.update({
      where: { id: lecture.id },
      data: {
        templatePath: repoFilePath,
        status: LectureStatus.ING,
      },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/lectures");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/tasks/assign");
  redirect(`/admin/tasks/assign?success=1&lectureId=${lectureId}&teacherId=${teacherId}`);
}

export async function deleteTaskAction(formData: FormData) {
  await requireRole("admin");

  const taskId = String(formData.get("taskId") ?? "").trim();

  if (!taskId) {
    redirect("/admin/tasks/assign?error=任务不存在");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, draftId: true },
  });

  if (!task) {
    redirect("/admin/tasks/assign?error=任务不存在");
  }

  // 彻底删除任务：提交记录、审核记录随外键级联删除；再删除其专属草稿。
  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: task.id } });

    if (task.draftId) {
      const remaining = await tx.task.count({ where: { draftId: task.draftId } });

      if (remaining === 0) {
        await tx.taskDraft.delete({ where: { id: task.draftId } });
      }
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/lectures");
  revalidatePath("/admin/tasks/assign");
  revalidatePath("/admin/reviews");
  revalidatePath("/teacher/tasks");
  redirect("/admin/tasks/assign?success=deleted");
}
