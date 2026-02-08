import { NextRequest, NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import { newId, updateDb } from "@/lib/data-store";
import { validateTelegramInitData } from "@/lib/telegram";

const ADMIN_TG_ID = 25125327;

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

  /* ── Admin hardcode: tg_id 25125327 always gets admin role ── */
  if (telegramUser.id === ADMIN_TG_ID) {
    const adminUser = await updateDb((db) => {
      let existing = db.users.find((u) => u.tgId === ADMIN_TG_ID);
      if (existing) {
        existing.fullName = fullName;
        if (existing.role !== "admin") existing.role = "admin";
        return existing;
      }
      const created = {
        id: newId("usr"),
        tgId: ADMIN_TG_ID,
        role: "admin" as const,
        fullName,
        phone: "",
        createdAt: now,
      };
      db.users.push(created);
      return created;
    });

    const response = NextResponse.json({
      ok: true,
      registered: true,
      user: { id: adminUser.id, role: adminUser.role, fullName: adminUser.fullName },
    });
    setSessionCookie(response, {
      userId: adminUser.id,
      role: adminUser.role,
      authMethod: "telegram",
    });
    return response;
  }

  /* ── Regular users: look up by tg_id ── */
  const existing = await updateDb((db) => {
    const found = db.users.find((u) => u.tgId === telegramUser.id);
    if (found) {
      found.fullName = fullName;
      return found;
    }
    return null;
  });

  if (existing) {
    const response = NextResponse.json({
      ok: true,
      registered: true,
      user: { id: existing.id, role: existing.role, fullName: existing.fullName },
    });
    setSessionCookie(response, {
      userId: existing.id,
      role: existing.role,
      authMethod: "telegram",
    });
    return response;
  }

  /* ── New user: return telegram data for registration form ── */
  return NextResponse.json({
    ok: true,
    registered: false,
    telegramUser: {
      id: telegramUser.id,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
    },
  });
}
