import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SETTINGS_COOKIE_NAME = "system_settings_access";
const SETTINGS_COOKIE_TTL_SECONDS = 60 * 60 * 8;

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("Missing AUTH_SECRET");
  }

  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function encodeAccessToken(payload: { exp: number }) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function decodeAccessToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);

  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      exp: number;
    };

    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getSystemSettingsPassword() {
  return process.env.SYSTEM_SETTINGS_PASSWORD?.trim() || "admin";
}

export function createSystemSettingsAccessToken() {
  return encodeAccessToken({
    exp: Date.now() + SETTINGS_COOKIE_TTL_SECONDS * 1000,
  });
}

export function getSystemSettingsCookieName() {
  return SETTINGS_COOKIE_NAME;
}

export async function hasSystemSettingsAccess() {
  const token = cookies().get(SETTINGS_COOKIE_NAME)?.value;
  return Boolean(decodeAccessToken(token));
}

export async function requireSystemSettingsAccess() {
  const hasAccess = await hasSystemSettingsAccess();

  if (!hasAccess) {
    redirect("/?settingsError=请先输入系统设置密码");
  }
}
