import { NextRequest, NextResponse } from "next/server";

import { readSession } from "@/lib/auth";
import { newId, readDb, updateDb } from "@/lib/data-store";

interface NewProductPayload {
  name?: string;
  sku?: string;
  category?: string;
  priceRub?: number;
  minQty?: number;
  stock?: number;
  imageUrl?: string;
  description?: string;
  tags?: string[];
}

const resolveStoreId = (role: "admin" | "seller", userStoreId?: string, storeId?: string) => {
  if (role === "admin") {
    return storeId;
  }
  return userStoreId;
};

export async function GET(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await readDb();
  const user = db.users.find((candidate) => candidate.id === session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role !== "seller" && user.role !== "admin") {
    return NextResponse.json({ error: "Insufficient rights" }, { status: 403 });
  }

  const requestedStore = request.nextUrl.searchParams.get("storeId") ?? undefined;
  const storeId = resolveStoreId(user.role, user.storeId, requestedStore);
  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const products = db.products.filter((item) => item.storeId === storeId);
  return NextResponse.json({ ok: true, products });
}

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as NewProductPayload & {
    storeId?: string;
  };

  if (!payload.name?.trim() || !payload.sku?.trim()) {
    return NextResponse.json({ error: "name and sku are required" }, { status: 400 });
  }
  const name = payload.name.trim();
  const sku = payload.sku.trim();

  try {
    const product = await updateDb((db) => {
      const user = db.users.find((candidate) => candidate.id === session.userId);
      if (!user) {
        throw new Error("User not found");
      }
      if (user.role !== "seller" && user.role !== "admin") {
        throw new Error("Insufficient rights");
      }

      const storeId = resolveStoreId(user.role, user.storeId, payload.storeId);
      if (!storeId) {
        throw new Error("storeId is required");
      }

      const store = db.stores.find((candidate) => candidate.id === storeId);
      if (!store) {
        throw new Error("Store not found");
      }

      const now = new Date().toISOString();
      const created = {
        id: newId("prd"),
        storeId,
        name,
        sku,
        category: payload.category?.trim() || "Без категории",
        priceRub: Math.max(1, Number(payload.priceRub) || 1),
        minQty: Math.max(1, Math.floor(Number(payload.minQty) || 1)),
        stock: Math.max(0, Math.floor(Number(payload.stock) || 0)),
        imageUrl:
          payload.imageUrl?.trim() ||
          "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=700&q=80",
        description: payload.description?.trim() || "",
        tags: (payload.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
        createdAt: now,
        updatedAt: now,
      };

      db.products.unshift(created);
      if (!store.categories.includes(created.category)) {
        store.categories.push(created.category);
      }
      return created;
    });

    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot create product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
