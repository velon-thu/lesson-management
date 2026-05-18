import { NextResponse } from "next/server";
import { TaskStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { compileLatexTask } from "@/lib/latex";
import { parseLatexLog } from "@/lib/latex-log";
import { prisma } from "@/lib/prisma";
import { findOwnedTeacherTask } from "@/lib/teacher-task";

type RouteContext = {
  params: {
    taskId: string;
  };
};

/**
 * 保存草稿并立即用 xelatex 编译，返回 JSON 结果（状态、日志、可定位错误）。
 * 供老师端编辑器原地编译使用，不刷新整页。
 */
export async function POST(request: Request, { params }: RouteContext) {
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

  await prisma.taskDraft.update({
    where: { id: task.draft.id },
    data: { texSource },
  });

  const result = await compileLatexTask({
    taskId: task.id,
    texSource,
    entryFilePath: task.lecture.templatePath,
    assets: task.assets.map((asset) => ({ filePath: asset.filePath })),
  });

  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.IN_PROGRESS,
      lastCompileStatus: result.status,
      lastCompileLog: result.log,
      // 编译失败时保留上一次成功的 PDF，便于继续预览。
      ...(result.pdfPath ? { lastPdfPath: result.pdfPath } : {}),
    },
  });

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    log: result.log,
    diagnostics: parseLatexLog(result.log),
    compiledAt: new Date().toISOString(),
    hasPdf: Boolean(result.pdfPath) || Boolean(task.lastPdfPath),
  });
}
