import { NextRequest, NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import { newId, updateDb } from "@/lib/data-store";
import { validateTelegramInitData } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  const { initData } = (await request.json().catch(() => ({}))) as {
    initData?: string;
  };

  if (!initData) {
    return NextResponse.json({ error: "initData is required" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: "Server has no TELEGRAM_BOT_TOKEN configured" },
      { status: 500 },
    );
  }

  const verified = validateTelegramInitData(initData, botToken);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const now = new Date().toISOString();
  const telegramUser = verified.data.user;
  const fullName =
    [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") ||
    telegramUser.username ||
    `User ${telegramUser.id}`;

  const user = await updateDb((db) => {
    const existing = db.users.find((candidate) => candidate.tgId === telegramUser.id);
    if (existing) {
      existing.fullName = fullName;
      return existing;
    }

    const created = {
      id: newId("usr"),
      tgId: telegramUser.id,
      role: "buyer" as const,
      fullName,
      phone: "",
      createdAt: now,
    };

    db.users.push(created);
    return created;
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
    },
  });

  setSessionCookie(response, {
    userId: user.id,
    role: user.role,
    authMethod: "telegram",
  });

  return response;
}
