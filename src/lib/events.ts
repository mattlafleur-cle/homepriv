import "server-only";
import { db, nowIso } from "./db";
import { effectiveMode } from "@/config/site";

/**
 * First-party funnel counts. Each row is an event name, an optional page
 * location, the launch mode, and a timestamp. No names, emails, addresses,
 * IP addresses, cookies, or device identifiers are stored.
 *
 * Server events pass `subject` (an internal record id) so a retried webhook
 * or a reloaded page can never count the same purchase twice.
 */

export const CLIENT_EVENTS = ["cta_primary_click", "eligibility_started"] as const;
export const SERVER_EVENTS = [
  "eligibility_submitted",
  "eligibility_approved",
  "checkout_started",
  "purchase_confirmed",
  "agent_inquiry",
] as const;
export const CTA_LOCATIONS = ["header", "hero", "pricing", "final", "sticky", "faq", "steps"] as const;

export type FunnelEvent = (typeof CLIENT_EVENTS)[number] | (typeof SERVER_EVENTS)[number];

export async function track(
  name: FunnelEvent,
  opts: { location?: string; subject?: string; isTest?: boolean } = {},
) {
  const mode = effectiveMode();
  await db.run("INSERT OR IGNORE INTO funnel_events(name, location, mode, is_test, subject, created_at) VALUES(?, ?, ?, ?, ?, ?)", name, opts.location ?? null, mode, opts.isTest || mode === "preview" ? 1 : 0, opts.subject ?? null, nowIso());
}

export async function funnelSummary(includeTest = false) {
  const rows = await db.all(`SELECT name, COUNT(*) AS n FROM funnel_events ${includeTest ? "" : "WHERE is_test = 0"} GROUP BY name`) as { name: string; n: number }[];
  const counts = Object.fromEntries(rows.map((r) => [r.name, Number(r.n)])) as Record<string, number>;
  const submitted = counts.eligibility_submitted ?? 0;
  const approved = counts.eligibility_approved ?? 0;
  const purchased = counts.purchase_confirmed ?? 0;
  return {
    counts,
    approvalRate: submitted ? approved / submitted : null,
    eligibilityToPurchase: approved ? purchased / approved : null,
  };
}
