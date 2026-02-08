import { NextRequest, NextResponse } from "next/server";

import { readSession } from "@/lib/auth";
import { updateDb } from "@/lib/data-store";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

interface ProductPatchPayload {
  name?: string;
  category?: string;
  priceRub?: number;
  minQty?: number;
  stock?: number;
  imageUrl?: string;
  description?: string;
  tags?: string[];
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as ProductPatchPayload;

  try {
    const product = await updateDb((db) => {
      const user = db.users.find((candidate) => candidate.id === session.userId);
      if (!user) {
        throw new Error("User not found");
      }
      if (user.role !== "seller" && user.role !== "admin") {
        throw new Error("Insufficient rights");
      }

      const productToUpdate = db.products.find((candidate) => candidate.id === productId);
      if (!productToUpdate) {
        throw new Error("Product not found");
      }

      if (user.role === "seller" && user.storeId !== productToUpdate.storeId) {
        throw new Error("Cannot update foreign store product");
      }

      if (payload.name !== undefined) {
        productToUpdate.name = payload.name.trim();
      }
      if (payload.category !== undefined) {
        productToUpdate.category = payload.category.trim() || "Без категории";
      }
      if (payload.priceRub !== undefined) {
        productToUpdate.priceRub = Math.max(1, Number(payload.priceRub) || 1);
      }
      if (payload.minQty !== undefined) {
        productToUpdate.minQty = Math.max(1, Math.floor(Number(payload.minQty) || 1));
      }
      if (payload.stock !== undefined) {
        productToUpdate.stock = Math.max(0, Math.floor(Number(payload.stock) || 0));
      }
      if (payload.imageUrl !== undefined) {
        productToUpdate.imageUrl = payload.imageUrl.trim();
      }
      if (payload.description !== undefined) {
        productToUpdate.description = payload.description.trim();
      }
      if (payload.tags !== undefined) {
        productToUpdate.tags = payload.tags.map((tag) => tag.trim()).filter(Boolean);
      }

      productToUpdate.updatedAt = new Date().toISOString();
      return productToUpdate;
    });

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot update product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
