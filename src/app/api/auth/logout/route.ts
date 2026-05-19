import { getSessionCookieName } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

export async function POST() {
  const response = redirectTo("/");

  response.cookies.set({
    name: getSessionCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
