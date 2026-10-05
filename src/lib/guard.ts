import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { hmac, safeEqual } from "./tokens";

/**
 * Abuse protection for public forms: a per-IP rate limit (stored hashed, never
 * the raw IP), a honeypot field, and a signed "form issued at" token that
 * rejects instant bot submissions. No third-party CAPTCHA, so nothing extra
 * for people using screen readers or keyboards.
 */

let fallbackSecret: string | undefined;
function secret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  fallbackSecret ??= crypto.randomBytes(32).toString("hex");
  return fallbackSecret;
}

export function clientIp(headers: Headers) {
  const fwd = headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? headers.get("x-real-ip") ?? "unknown").trim();
}

function ipKey(scope: string, ip: string) {
  return crypto.createHash("sha256").update(`${secret()}|${scope}|${ip}`).digest("hex").slice(0, 32);
}

/** Fixed-window counter. Returns true when the request is allowed. */
export async function rateLimit(scope: string, ip: string, limit: number, windowSeconds: number) {
  const key = ipKey(scope, ip);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const row = await db.get("SELECT window_start, count FROM rate_limits WHERE key = ?", key) as
    | { window_start: number; count: number }
    | undefined;
  if (!row || row.window_start !== windowStart) {
    await db.run("INSERT INTO rate_limits(key, window_start, count) VALUES(?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1", key, windowStart);
    return true;
  }
  if (row.count >= limit) return false;
  await db.run("UPDATE rate_limits SET count = count + 1 WHERE key = ?", key);
  return true;
}

export function issueFormToken(now = Date.now()) {
  const ts = String(now);
  return `${ts}.${hmac(secret(), `form|${ts}`)}`;
}

export type FormTokenCheck = "ok" | "invalid" | "too_fast" | "expired";

export function checkFormToken(token: unknown, now = Date.now(), minMs = 2500): FormTokenCheck {
  if (typeof token !== "string") return "invalid";
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !safeEqual(sig, hmac(secret(), `form|${ts}`))) return "invalid";
  const age = now - Number(ts);
  if (!Number.isFinite(age) || age < 0) return "invalid";
  if (age < minMs) return "too_fast";
  if (age > 24 * 60 * 60 * 1000) return "expired";
  return "ok";
}
