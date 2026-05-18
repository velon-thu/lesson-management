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

/**
 * 不做重定向的归属校验版本，供 JSON API 路由使用：
 * 任务不存在或不属于该老师时返回 null，由调用方决定响应状态码。
 */
export async function findOwnedTeacherTask(taskId: string, teacherId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      lecture: {
        select: {
          code: true,
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

  if (!task || task.assigneeId !== teacherId) {
    return null;
  }

  return task;
}
