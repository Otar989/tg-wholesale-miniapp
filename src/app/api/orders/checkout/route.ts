import { NextRequest, NextResponse } from "next/server";

import { readSession } from "@/lib/auth";
import { newId, updateDb } from "@/lib/data-store";
import { Order, OrderItem, Product } from "@/lib/types";

interface CheckoutItemPayload {
  productId: string;
  qty: number;
}

interface CheckoutPayload {
  items: CheckoutItemPayload[];
  deliveryAddress: string;
  comment?: string;
}

const DELIVERY_FEE_RUB = 2000;

const normalizeQuantity = (value: number) => Math.floor(Number(value));

const toOrderItem = (product: Product, qty: number): OrderItem => ({
  productId: product.id,
  name: product.name,
  sku: product.sku,
  qty,
  priceRub: product.priceRub,
});

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as CheckoutPayload;
  const items = payload.items ?? [];
  const deliveryAddress = payload.deliveryAddress?.trim();

  if (!items.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }
  if (!deliveryAddress) {
    return NextResponse.json({ error: "Delivery address is required" }, { status: 400 });
  }

  try {
    const createdOrders = await updateDb((db) => {
      const user = db.users.find((candidate) => candidate.id === session.userId);
      if (!user) {
        throw new Error("User not found");
      }
      if (user.role === "seller") {
        throw new Error("Sellers cannot checkout");
      }

      const groupedByStore = new Map<string, OrderItem[]>();

      for (const item of items) {
        const qty = normalizeQuantity(item.qty);
        if (!item.productId || !qty || qty <= 0) {
          throw new Error("Invalid cart item");
        }

        const product = db.products.find((candidate) => candidate.id === item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (qty < product.minQty) {
          throw new Error(`${product.name}: minimum order is ${product.minQty}`);
        }
        if (qty > product.stock) {
          throw new Error(`${product.name}: only ${product.stock} pcs left`);
        }

        product.stock -= qty;
        product.updatedAt = new Date().toISOString();

        const current = groupedByStore.get(product.storeId) ?? [];
        groupedByStore.set(product.storeId, [...current, toOrderItem(product, qty)]);
      }

      const now = new Date().toISOString();
      const orders: Order[] = [...groupedByStore.entries()].map(([storeId, orderItems]) => {
        const subtotalRub = orderItems.reduce(
          (sum, item) => sum + item.priceRub * item.qty,
          0,
        );
        return {
          id: newId("ord"),
          buyerId: user.id,
          storeId,
          status: "new",
          items: orderItems,
          subtotalRub,
          deliveryFeeRub: DELIVERY_FEE_RUB,
          totalRub: subtotalRub + DELIVERY_FEE_RUB,
          deliveryAddress,
          comment: payload.comment?.trim(),
          createdAt: now,
          updatedAt: now,
        };
      });

      db.orders.unshift(...orders);
      return orders;
    });

    return NextResponse.json({ ok: true, orders: createdOrders }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
