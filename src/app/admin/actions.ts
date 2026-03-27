"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LectureStatus, TaskStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInitialTexSource } from "@/lib/task-template";

function normalizeDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  return new Date(`${raw}T23:59:59.000Z`);
}

function normalizeLectureStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "").trim();

  if (status === LectureStatus.ACTIVE || status === LectureStatus.ARCHIVED) {
    return status;
  }

  return LectureStatus.DRAFT;
}

export async function saveLectureAction(formData: FormData) {
  const user = await requireRole("admin");
  const lectureId = String(formData.get("lectureId") ?? "").trim();
  const payload = {
    code: String(formData.get("code") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    chapter: String(formData.get("chapter") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    deadline: normalizeDate(formData.get("deadline")),
    templatePath: String(formData.get("templatePath") ?? "").trim(),
    status: normalizeLectureStatus(formData.get("status")),
    createdById: user.id,
  };

  if (!payload.code || !payload.title || !payload.chapter || !payload.templatePath) {
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

export async function assignTaskAction(formData: FormData) {
  const admin = await requireRole("admin");
  const lectureId = String(formData.get("lectureId") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "").trim();

  if (!lectureId || !teacherId) {
    redirect("/admin/tasks/assign?error=missing");
  }

  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: {
      id: true,
      code: true,
      title: true,
      chapter: true,
      description: true,
      templatePath: true,
    },
  });

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: UserRole.TEACHER, isActive: true },
    select: { id: true, name: true },
  });

  if (!lecture || !teacher) {
    redirect("/admin/tasks/assign?error=invalid");
  }

  const taskId = randomUUID();
  const branchName = `task/${taskId}`;
  const texSource = buildInitialTexSource({
    taskId,
    teacherName: teacher.name,
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
        title: `${lecture.title} - ${teacher.name}`,
        lectureId: lecture.id,
        draftId: draft.id,
        createdById: admin.id,
        assigneeId: teacher.id,
        branchName,
        status: TaskStatus.ASSIGNED,
        compiler: "xelatex",
      },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/lectures");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/tasks/assign");
  redirect(`/admin/tasks/assign?success=1&lectureId=${lectureId}&teacherId=${teacherId}`);
}
