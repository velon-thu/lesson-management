import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { compileLecturePreview } from "@/lib/gitea-submit";
import { normalizeLectureRepoFilePath } from "@/lib/lecture-repo-path";

/**
 * 编译预览讲义的修改稿，不提交任何改动。
 * 请求体：{ path: 仓库内的 .tex 路径, texSource: 待编译内容 }。
 * 返回编译日志，成功时附带 base64 编码的 PDF。
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

  try {
    const result = await compileLecturePreview({ templatePath: safePath, content: texSource });

    return NextResponse.json({
      ok: result.ok,
      log: result.log,
      pdf: result.pdf ? result.pdf.toString("base64") : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "编译预览失败。";
    return NextResponse.json({ ok: false, log: message, pdf: null }, { status: 500 });
  }
}
