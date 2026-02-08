import { NextRequest, NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import { newId, updateDb } from "@/lib/data-store";
import { validateTelegramInitData } from "@/lib/telegram";

interface StoreData {
  name: string;
  city: string;
  address?: string;
  phone?: string;
  minOrderRub?: number;
  deliveryDays?: number;
  description?: string;
}

interface RegisterPayload {
  initData: string;
  role: "buyer" | "seller";
  fullName: string;
  phone: string;
  deliveryAddress?: string;
  storeData?: StoreData;
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as Partial<RegisterPayload>;

  /* ── Validate initData ── */
  if (!payload.initData) {
    return NextResponse.json({ error: "initData is required" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: "Server has no TELEGRAM_BOT_TOKEN configured" },
      { status: 500 },
    );
  }

  const verified = validateTelegramInitData(payload.initData, botToken);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const telegramUser = verified.data.user;

  /* ── Validate fields ── */
  const role = payload.role as string | undefined;
  if (!role || !["buyer", "seller"].includes(role)) {
    return NextResponse.json(
      { error: "Роль должна быть 'buyer' или 'seller'" },
      { status: 400 },
    );
  }

  if (!payload.fullName?.trim()) {
    return NextResponse.json({ error: "Укажите имя" }, { status: 400 });
  }

  if (!payload.phone?.trim()) {
    return NextResponse.json({ error: "Укажите телефон" }, { status: 400 });
  }

  if (payload.role === "seller") {
    if (!payload.storeData?.name?.trim()) {
      return NextResponse.json({ error: "Укажите название магазина" }, { status: 400 });
    }
    if (!payload.storeData?.city?.trim()) {
      return NextResponse.json({ error: "Укажите город магазина" }, { status: 400 });
    }
  }

  /* ── Create user (and store for sellers) ── */
  const now = new Date().toISOString();

  try {
    const result = await updateDb((db) => {
      /* Prevent duplicate registration */
      if (db.users.some((u) => u.tgId === telegramUser.id)) {
        throw new Error("Этот Telegram-аккаунт уже зарегистрирован");
      }

      let storeId: string | undefined;

      /* Create store for seller */
      if (payload.role === "seller" && payload.storeData) {
        const store = {
          id: newId("store"),
          name: payload.storeData.name.trim(),
          city: payload.storeData.city.trim(),
          address: payload.storeData.address?.trim() ?? "",
          description: payload.storeData.description?.trim() ?? "",
          phone: payload.storeData.phone?.trim() ?? "",
          minOrderRub: Math.max(0, payload.storeData.minOrderRub ?? 10000),
          deliveryDays: Math.max(1, Math.floor(payload.storeData.deliveryDays ?? 2)),
          rating: 0,
          verified: false,
          logoUrl: "",
          coverUrl: "",
          categories: [] as string[],
          createdAt: now,
        };
        db.stores.push(store);
        storeId = store.id;
      }

      /* Create user */
      const user = {
        id: newId("usr"),
        tgId: telegramUser.id,
        role: payload.role as "buyer" | "seller",
        fullName: payload.fullName!.trim(),
        phone: payload.phone!.trim(),
        storeId,
        createdAt: now,
      };
      db.users.push(user);

      return user;
    });

    const response = NextResponse.json(
      {
        ok: true,
        user: {
          id: result.id,
          role: result.role,
          fullName: result.fullName,
        },
      },
      { status: 201 },
    );

    setSessionCookie(response, {
      userId: result.id,
      role: result.role,
      authMethod: "telegram",
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка регистрации";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
