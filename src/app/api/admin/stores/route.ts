import { NextRequest, NextResponse } from "next/server";

import { readSession } from "@/lib/auth";
import { newId, readDb, updateDb } from "@/lib/data-store";

interface CreateStorePayload {
  name?: string;
  city?: string;
  address?: string;
  description?: string;
  phone?: string;
  minOrderRub?: number;
  deliveryDays?: number;
  logoUrl?: string;
  coverUrl?: string;
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
    return NextResponse.json({ ok: true, stores: db.stores });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureAdmin(request);
    const payload = (await request.json().catch(() => ({}))) as CreateStorePayload;

    if (!payload.name?.trim() || !payload.city?.trim()) {
      return NextResponse.json({ error: "name and city are required" }, { status: 400 });
    }

    const store = await updateDb((db) => {
      const now = new Date().toISOString();
      const created = {
        id: newId("store"),
        name: payload.name!.trim(),
        city: payload.city!.trim(),
        address: payload.address?.trim() || "",
        description: payload.description?.trim() || "",
        phone: payload.phone?.trim() || "",
        minOrderRub: Math.max(1, Number(payload.minOrderRub) || 1),
        deliveryDays: Math.max(1, Math.floor(Number(payload.deliveryDays) || 2)),
        rating: 5,
        verified: true,
        logoUrl:
          payload.logoUrl?.trim() ||
          "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=180&q=80",
        coverUrl:
          payload.coverUrl?.trim() ||
          "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=1400&q=80",
        categories: [],
        createdAt: now,
      };
      db.stores.unshift(created);
      return created;
    });

    return NextResponse.json({ ok: true, store }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot create store";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
