import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function getOwnedTeacherTask(taskId: string, teacherId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      lecture: {
        select: {
          id: true,
          code: true,
          title: true,
          chapter: true,
          description: true,
          deadline: true,
          templatePath: true,
          status: true,
        },
      },
      draft: {
        select: {
          id: true,
          title: true,
          texSource: true,
          updatedAt: true,
        },
      },
      reviewRecords: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          reviewer: {
            select: {
              name: true,
              username: true,
              role: true,
            },
          },
        },
      },
      assets: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          fileName: true,
          filePath: true,
          mimeType: true,
          createdAt: true,
        },
      },
    },
  });

  if (!task) {
    notFound();
  }

  if (task.assigneeId !== teacherId) {
    redirect("/forbidden");
  }

  return task;
}
