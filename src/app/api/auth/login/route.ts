import { UserRole } from "@prisma/client";
import {
  createSessionToken,
  getRedirectPathByRole,
  getSessionCookieName,
  type AppRole,
  verifyPassword,
} from "@/lib/auth";
import { redirectTo } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function redirectToLogin(error: string, role?: string) {
  const params = new URLSearchParams({ error });

  if (role === "admin" || role === "teacher") {
    params.set("role", role);
  }

  return redirectTo(`/?${params.toString()}`);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const selectedRole = String(formData.get("role") ?? "");

  if (!username || !password) {
    return redirectToLogin("请输入用户名和密码", selectedRole);
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      isActive: true,
      role: true,
    },
  });

  if (!user || !user.passwordHash || !user.isActive) {
    return redirectToLogin("用户名或密码错误", selectedRole);
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return redirectToLogin("用户名或密码错误", selectedRole);
  }

  const role: AppRole = user.role === UserRole.ADMIN ? "admin" : "teacher";
  const response = redirectTo(getRedirectPathByRole(role));

  response.cookies.set({
    name: getSessionCookieName(),
    value: createSessionToken({ id: user.id, role }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}
