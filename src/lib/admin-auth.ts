import "server-only";
import { cookies } from "next/headers";
import { adminConfig } from "@/config/site";
import { hmac, safeEqual } from "./tokens";

/**
 * Single-operator admin access. The password and signing secret come from
 * environment variables. The session cookie is HttpOnly, SameSite=Strict,
 * signed, and expires after 12 hours. Admin is disabled entirely until both
 * values are set.
 */

export const ADMIN_COOKIE = "hpc_admin";
const TTL_MS = 12 * 60 * 60 * 1000;

export function adminEnabled() {
  const { password, sessionSecret } = adminConfig();
  return Boolean(password && sessionSecret && sessionSecret.length >= 16);
}

export function checkPassword(candidate: string) {
  const { password, sessionSecret } = adminConfig();
  if (!password || !sessionSecret) return false;
  // Compare HMACs so length differences don't leak through timing.
  return safeEqual(hmac(sessionSecret, `pw|${candidate}`), hmac(sessionSecret, `pw|${password}`));
}

export function makeSessionValue(now = Date.now()) {
  const { sessionSecret } = adminConfig();
  if (!sessionSecret) throw new Error("SESSION_SECRET missing");
  const exp = String(now + TTL_MS);
  return `${exp}.${hmac(sessionSecret, `admin|${exp}`)}`;
}

export function verifySessionValue(value: string | undefined, now = Date.now()) {
  const { sessionSecret } = adminConfig();
  if (!value || !sessionSecret || !adminEnabled()) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig) return false;
  if (!safeEqual(sig, hmac(sessionSecret, `admin|${exp}`))) return false;
  return Number(exp) > now;
}

export async function isAdmin() {
  const store = await cookies();
  return verifySessionValue(store.get(ADMIN_COOKIE)?.value);
}

export async function startAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, makeSessionValue(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: TTL_MS / 1000,
  });
}

export async function endAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { path: "/admin", maxAge: 0 });
}
