import { NextRequest, NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import { readDb } from "@/lib/data-store";
import { Role } from "@/lib/types";

const ALLOWED_ROLES: Role[] = ["admin", "seller", "buyer"];

export async function POST(request: NextRequest) {
  const { role } = (await request.json().catch(() => ({}))) as { role?: Role };

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  const db = await readDb();
  const user = db.users.find((candidate) => candidate.role === role);

  if (!user) {
    return NextResponse.json({ error: "No user with this role" }, { status: 404 });
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
    },
  });

  setSessionCookie(response, {
    userId: user.id,
    role: user.role,
    authMethod: "demo",
  });

  return response;
}
