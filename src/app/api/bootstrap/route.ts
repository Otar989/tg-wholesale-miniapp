import { NextRequest, NextResponse } from "next/server";

import { readSession } from "@/lib/auth";
import { buildBootstrap, unauthenticatedBootstrap } from "@/lib/bootstrap";
import { readDb } from "@/lib/data-store";

export async function GET(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json(unauthenticatedBootstrap());
  }

  const db = await readDb();
  const user = db.users.find((candidate) => candidate.id === session.userId);
  if (!user) {
    return NextResponse.json(unauthenticatedBootstrap());
  }

  return NextResponse.json(buildBootstrap(db, user));
}
