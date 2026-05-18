import { NextResponse } from "next/server";
import {
  createSystemSettingsAccessToken,
  getSystemSettingsCookieName,
  getSystemSettingsPassword,
} from "@/lib/system-settings";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");

  if (password !== getSystemSettingsPassword()) {
    return NextResponse.redirect(new URL("/?settingsError=系统设置密码错误", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/system-settings", request.url), 303);
  response.cookies.set({
    name: getSystemSettingsCookieName(),
    value: createSystemSettingsAccessToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
