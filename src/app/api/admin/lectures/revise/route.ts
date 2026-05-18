import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reviseLectureOnMain } from "@/lib/gitea-submit";
import { normalizeLectureRepoFilePath } from "@/lib/lecture-repo-path";

/**
 * 修改讲义并轻量发布：先编译校验，通过才直接提交到仓库主分支。
 * 请求体：{ path: 仓库内的 .tex 路径, texSource: 新内容 }。
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "未登录或无权限。" }, { status: 401 });
  }

  let rawPath = "";
  let texSource = "";

  try {
    const body = await request.json();
    rawPath = String(body?.path ?? "");
    texSource = String(body?.texSource ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "请求体格式不正确。" }, { status: 400 });
  }

  let safePath = "";

  try {
    safePath = normalizeLectureRepoFilePath(rawPath);
  } catch {
    return NextResponse.json({ ok: false, error: "讲义路径不合法。" }, { status: 400 });
  }

  if (!texSource.trim()) {
    return NextResponse.json({ ok: false, error: "讲义内容不能为空。" }, { status: 400 });
  }

  try {
    const result = await reviseLectureOnMain({ templatePath: safePath, content: texSource });

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: "编译未通过，已阻止发布，请根据日志修正后重试。",
        log: result.log,
      });
    }

    return NextResponse.json({
      ok: true,
      log: result.log,
      pdf: result.pdf ? result.pdf.toString("base64") : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发布修改失败。";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
