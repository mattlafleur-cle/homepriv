import "server-only";
import crypto from "node:crypto";

/** Opaque, URL-safe customer token. Only its hash is stored. */
export function newAccessToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isWellFormedToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

/** Short reference shown to customers, e.g. HPC-7KQ4X9. Not a secret. */
export function newRefCode(prefix = "HPC") {
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return `${prefix}-${out}`;
}

export const newId = () => crypto.randomUUID();

export function hmac(secret: string, value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
