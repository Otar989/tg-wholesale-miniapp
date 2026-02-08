import { NextRequest, NextResponse } from "next/server";

import { readSession } from "@/lib/auth";
import { newId, readDb, updateDb } from "@/lib/data-store";
import { Role } from "@/lib/types";

interface CreateUserPayload {
  fullName?: string;
  phone?: string;
  role?: Role;
  storeId?: string;
  tgId?: number;
}

const ensureAdmin = async (request: NextRequest) => {
  const session = readSession(request);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const db = await readDb();
  const user = db.users.find((candidate) => candidate.id === session.userId);
  if (!user || user.role !== "admin") {
    throw new Error("Admin access required");
  }
};

export async function GET(request: NextRequest) {
  try {
    await ensureAdmin(request);
    const db = await readDb();
    return NextResponse.json({
      ok: true,
      users: db.users.map((user) => ({
        id: user.id,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        storeId: user.storeId,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureAdmin(request);
    const payload = (await request.json().catch(() => ({}))) as CreateUserPayload;

    if (!payload.fullName?.trim() || !payload.role) {
      return NextResponse.json(
        { error: "fullName and role are required" },
        { status: 400 },
      );
    }
    if (payload.role === "admin") {
      return NextResponse.json(
        { error: "Admin users cannot be created via this endpoint" },
        { status: 403 },
      );
    }
    if (payload.role === "seller" && !payload.storeId) {
      return NextResponse.json(
        { error: "Seller must have storeId" },
        { status: 400 },
      );
    }

    const created = await updateDb((db) => {
      if (
        payload.tgId &&
        db.users.some((candidate) => candidate.tgId && candidate.tgId === payload.tgId)
      ) {
        throw new Error("User with this Telegram ID already exists");
      }

      if (payload.role === "seller") {
        const storeExists = db.stores.some((store) => store.id === payload.storeId);
        if (!storeExists) {
          throw new Error("Store not found");
        }
      }

      const user = {
        id: newId("usr"),
        role: payload.role!,
        fullName: payload.fullName!.trim(),
        phone: payload.phone?.trim() || "",
        tgId: payload.tgId ? Number(payload.tgId) : undefined,
        storeId: payload.role === "seller" ? payload.storeId : undefined,
        createdAt: new Date().toISOString(),
      };

      db.users.unshift(user);
      return user;
    });

    return NextResponse.json({ ok: true, user: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot create user";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
