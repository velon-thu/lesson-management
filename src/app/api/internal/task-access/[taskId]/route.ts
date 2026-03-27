import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    taskId: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  if (request.headers.get("x-internal-auth") !== process.env.AUTH_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = request.headers.get("x-user-id");
  const userRole = request.headers.get("x-user-role");

  if (!userId || !userRole) {
    return NextResponse.json({ ok: false, error: "Missing user context" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    select: {
      id: true,
      assigneeId: true,
    },
  });

  if (!task) {
    return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  }

  if (userRole === "teacher" && task.assigneeId !== userId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
