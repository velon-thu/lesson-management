import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const usersCount = await prisma.user.count();

    return NextResponse.json({
      ok: true,
      database: "connected",
      usersCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        ok: false,
        database: "disconnected",
        usersCount: 0,
        error: message,
      },
      { status: 500 }
    );
  }
}
