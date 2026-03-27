import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("from", pathname);
    loginUrl.searchParams.set("role", pathname.startsWith("/admin") ? "admin" : "teacher");
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/teacher", request.url));
  }

  if (pathname.startsWith("/teacher") && session.role !== "teacher") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*"],
};
