import { createHmac, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { Role } from "./types";

const COOKIE_NAME = "om_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "change-this-in-production-session-secret";

export interface SessionPayload {
  userId: string;
  role: Role;
  authMethod: "demo" | "telegram";
  issuedAt: number;
}

const toBase64Url = (value: string) => Buffer.from(value).toString("base64url");

const fromBase64Url = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string) =>
  createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");

const safeEquals = (a: string, b: string) => {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
};

export const createSessionToken = (payload: SessionPayload): string => {
  const body = toBase64Url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
};

export const parseSessionToken = (token?: string): SessionPayload | null => {
  if (!token) {
    return null;
  }
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }
  const expected = sign(body);
  if (!safeEquals(signature, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(fromBase64Url(body)) as SessionPayload;
    const maxIssueTime = Math.floor(Date.now() / 1000) - SESSION_TTL_SECONDS;
    if (payload.issuedAt < maxIssueTime) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const readSession = (request: NextRequest): SessionPayload | null => {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return parseSessionToken(token);
};

export const setSessionCookie = (
  response: NextResponse,
  payload: Omit<SessionPayload, "issuedAt">,
) => {
  const token = createSessionToken({
    ...payload,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
};
