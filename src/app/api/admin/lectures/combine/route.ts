import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { combineLecturesPdf } from "@/lib/gitea-submit";
import { prisma } from "@/lib/prisma";

function redirectWithError(request: Request, message: string) {
  const url = new URL("/admin/lectures", request.url);
  url.searchParams.set("error", message.slice(0, 200));
  return NextResponse.redirect(url, 303);
}

/**
 * 组合多份已完成讲义并下载成一个 PDF。
 * 浏览器以 GET 表单提交，勾选的讲义通过重复的 lectureId 查询参数传入。
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "未登录或无权限。" }, { status: 401 });
  }

  const ids = new URL(request.url).searchParams.getAll("lectureId").filter(Boolean);

  if (ids.length === 0) {
    return redirectWithError(request, "请至少勾选一份已完成讲义再组合下载。");
  }

  const lectures = await prisma.lecture.findMany({
    where: { id: { in: ids }, status: "DONE" },
    orderBy: { code: "asc" },
    select: { code: true, title: true, templatePath: true },
  });

  if (lectures.length === 0) {
    return redirectWithError(request, "未找到可组合的已完成讲义。");
  }

  try {
    const pdf = await combineLecturesPdf(lectures);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="combined-lectures.pdf"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "组合下载失败。";
    return redirectWithError(request, message);
  }
}
