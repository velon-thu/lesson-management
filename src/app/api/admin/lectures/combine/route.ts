import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { combineLecturesPdf } from "@/lib/gitea-submit";

function redirectWithError(request: Request, message: string) {
  const url = new URL("/admin/lectures", request.url);
  url.searchParams.set("error", message.slice(0, 200));
  return NextResponse.redirect(url, 303);
}

/**
 * 组合多份讲义并下载成一个 PDF。
 * 浏览器以 GET 表单提交，勾选的讲义通过重复的 path 查询参数（仓库文件路径）传入。
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "未登录或无权限。" }, { status: 401 });
  }

  const paths = new URL(request.url).searchParams.getAll("path").filter(Boolean);

  if (paths.length === 0) {
    return redirectWithError(request, "请至少勾选一份讲义再组合下载。");
  }

  try {
    const pdf = await combineLecturesPdf(paths);

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
