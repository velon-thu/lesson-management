import { redirectTo } from "@/lib/http";
import {
  createSystemSettingsAccessToken,
  getSystemSettingsCookieName,
  getSystemSettingsPassword,
} from "@/lib/system-settings";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");

  if (password !== getSystemSettingsPassword()) {
    return redirectTo(`/?settingsError=${encodeURIComponent("系统设置密码错误")}`);
  }

  const response = redirectTo("/system-settings");
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
