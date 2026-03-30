"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, UserRole } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSystemSettingsAccess } from "@/lib/system-settings";

function buildSystemSettingsUrl(params?: Record<string, string>) {
  const url = new URL("http://local/system-settings");

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}`;
}

export async function createManagedUserAction(formData: FormData) {
  await requireSystemSettingsAccess();

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "").trim();
  const email = `${username}@zjjx.local`;

  if (!username || !password || !role) {
    redirect(buildSystemSettingsUrl({ error: "请完整填写账号信息" }));
  }

  if (role !== UserRole.ADMIN && role !== UserRole.TEACHER) {
    redirect(buildSystemSettingsUrl({ error: "账号角色不合法" }));
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
    select: { id: true },
  });

  if (existing) {
    redirect(buildSystemSettingsUrl({ error: "用户名已存在" }));
  }

  await prisma.user.create({
    data: {
      username,
      email,
      name: username,
      role,
      isActive: true,
      passwordHash: hashPassword(password),
      passwordPlain: password,
    },
  });

  revalidatePath("/system-settings");
  redirect(buildSystemSettingsUrl({ success: "created" }));
}

export async function deactivateManagedUserAction(formData: FormData) {
  await requireSystemSettingsAccess();

  const userId = String(formData.get("userId") ?? "").trim();
  const expectedUsername = String(formData.get("expectedUsername") ?? "").trim();
  const confirmedUsername = String(formData.get("confirmedUsername") ?? "").trim();

  if (!userId || !expectedUsername) {
    redirect(buildSystemSettingsUrl({ error: "缺少要注销的账号信息" }));
  }

  if (!confirmedUsername) {
    redirect(buildSystemSettingsUrl({ error: "请先输入该账号的用户名再注销" }));
  }

  if (confirmedUsername !== expectedUsername) {
    redirect(buildSystemSettingsUrl({ error: "输入的用户名不匹配，无法注销账号" }));
  }

  try {
    await prisma.user.delete({
      where: { id: userId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      redirect(buildSystemSettingsUrl({ error: "该账号已关联业务数据，暂时不能删除" }));
    }

    throw error;
  }

  revalidatePath("/system-settings");
  redirect(buildSystemSettingsUrl({ success: "deleted" }));
}
