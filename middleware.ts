import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { redirectTo } from "@/lib/http";

type SessionPayload = {
  userId: string;
  role: "admin" | "teacher";
  exp: number;
};

const SESSION_COOKIE_NAME = "auth_session";

function base64UrlToUint8Array(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function uint8ArrayToBase64Url(value: Uint8Array) {
  const binary = Array.from(value, (byte) => String.fromCharCode(byte)).join("");

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));

  return uint8ArrayToBase64Url(new Uint8Array(signature));
}

async function decodeSession(
  token: string | undefined,
  secret: string | undefined
): Promise<SessionPayload | null> {
  if (!token || !secret) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await signPayload(encodedPayload, secret);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToUint8Array(encodedPayload))
    ) as SessionPayload;

    if (
      typeof payload.userId !== "string" ||
      (payload.role !== "admin" && payload.role !== "teacher") ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = await decodeSession(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    process.env.AUTH_SECRET
  );

  if (!session) {
    const params = new URLSearchParams({
      from: pathname,
      role: pathname.startsWith("/admin") ? "admin" : "teacher",
    });
    return redirectTo(`/?${params.toString()}`, 307);
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return redirectTo("/teacher", 307);
  }

  if (pathname.startsWith("/teacher") && session.role !== "teacher") {
    return redirectTo("/admin", 307);
  }

  const teacherTaskMatch = pathname.match(/^\/teacher\/tasks\/([^/]+)(?:\/edit)?$/);

  if (session.role === "teacher" && teacherTaskMatch) {
    const taskId = teacherTaskMatch[1];
    const verifyResponse = await fetch(new URL(`/api/internal/task-access/${taskId}`, request.url), {
      headers: {
        "x-internal-auth": process.env.AUTH_SECRET ?? "",
        "x-user-id": session.userId,
        "x-user-role": session.role,
      },
    });

    if (verifyResponse.status === 403) {
      return new NextResponse(
        `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>403 Forbidden</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#f3f6fb;margin:0;padding:32px;color:#111827}main{max-width:720px;margin:80px auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;box-shadow:0 18px 50px rgba(15,23,42,.08)}h1{margin:0 0 12px;font-size:32px}p{color:#64748b;line-height:1.7;margin:0 0 12px}a{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:12px;background:#111827;color:#fff;text-decoration:none;margin-top:8px}</style></head><body><main><h1>无权限访问</h1><p>当前任务不属于你的账号，系统已在服务端阻止访问。</p><p>请返回我的任务列表，查看系统分配给你的任务内容。</p><a href="/teacher/tasks">返回我的任务</a></main></body></html>`,
        {
          status: 403,
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*"],
};
