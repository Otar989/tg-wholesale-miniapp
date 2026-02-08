import { NextRequest, NextResponse } from "next/server";

import { readSession } from "@/lib/auth";
import { updateDb } from "@/lib/data-store";
import { OrderStatus } from "@/lib/types";

const ALLOWED_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "packing",
  "shipping",
  "delivered",
  "cancelled",
];

interface RouteContext {
  params: Promise<{
    orderId: string;
  }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await context.params;
  const { status } = (await request.json().catch(() => ({}))) as {
    status?: OrderStatus;
  };

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const updated = await updateDb((db) => {
      const user = db.users.find((candidate) => candidate.id === session.userId);
      if (!user) {
        throw new Error("User not found");
      }
      if (user.role !== "admin" && user.role !== "seller") {
        throw new Error("Insufficient rights");
      }

      const order = db.orders.find((candidate) => candidate.id === orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      if (user.role === "seller" && user.storeId !== order.storeId) {
        throw new Error("Cannot update foreign store order");
      }

      order.status = status;
      order.updatedAt = new Date().toISOString();
      return order;
    });

    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot update order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
