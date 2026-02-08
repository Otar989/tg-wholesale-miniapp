import { createHmac, timingSafeEqual } from "crypto";

interface TelegramInitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  user: TelegramInitDataUser;
  authDate: number;
  queryId?: string;
}

export const validateTelegramInitData = (
  initData: string,
  botToken: string,
  maxAgeSeconds = 60 * 60 * 24,
): { ok: true; data: VerifiedInitData } | { ok: false; error: string } => {
  if (!initData.trim()) {
    return { ok: false, error: "initData is empty" };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, error: "hash is missing in initData" };
  }

  const pairs = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = pairs.map(([key, value]) => `${key}=${value}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const hashBuffer = Buffer.from(hash, "hex");
  const calculatedBuffer = Buffer.from(calculatedHash, "hex");
  const signatureValid =
    hashBuffer.length === calculatedBuffer.length &&
    timingSafeEqual(hashBuffer, calculatedBuffer);

  if (!signatureValid) {
    return { ok: false, error: "Invalid initData hash" };
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate) {
    return { ok: false, error: "auth_date is missing" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - authDate > maxAgeSeconds) {
    return { ok: false, error: "initData expired" };
  }

  const userJson = params.get("user");
  if (!userJson) {
    return { ok: false, error: "user is missing in initData" };
  }

  try {
    const parsedUser = JSON.parse(userJson) as TelegramInitDataUser;
    if (!parsedUser.id) {
      return { ok: false, error: "Invalid telegram user id" };
    }
    return {
      ok: true,
      data: {
        user: parsedUser,
        authDate,
        queryId: params.get("query_id") ?? undefined,
      },
    };
  } catch {
    return { ok: false, error: "Cannot parse user from initData" };
  }
};
