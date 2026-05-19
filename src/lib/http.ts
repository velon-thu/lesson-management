import { NextResponse } from "next/server";

/**
 * 生成「相对路径」重定向响应。
 *
 * 不用 NextResponse.redirect(new URL(path, request.url))：反向代理环境下
 * request.url 的 host 是容器内部地址（localhost:3000），会把浏览器导到错误地址。
 * 改用相对 Location 头，浏览器会基于当前公网地址解析，始终正确。
 */
export function redirectTo(path: string, status = 303): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { Location: path },
  });
}
