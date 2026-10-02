import "server-only";
import { db, tx } from "./db";
import { offer } from "@/config/offer";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

/**
 * Delete records past the retention periods published on the privacy page.
 * Paid orders and their inquiries are business records and are not touched.
 * Run daily, e.g. from cron: npm run ops -- purge
 */
export function purgeExpired({ dryRun = false } = {}) {
  const conn = db();
  const declinedBefore = daysAgo(offer.retention.declinedInquiryDays);
  const unpaidBefore = daysAgo(offer.retention.unpaidApprovedInquiryDays);
  const agentsBefore = daysAgo(offer.retention.agentInquiryDays);

  const expired = conn
    .prepare(
      `SELECT id FROM inquiries WHERE
        (status IN ('declined','listed_not_eligible') AND updated_at < ?)
        OR (status IN ('approved','pending_review') AND updated_at < ?)`,
    )
    .all(declinedBefore, unpaidBefore) as { id: string }[];
  const agentCount = (conn.prepare("SELECT COUNT(*) n FROM agent_inquiries WHERE created_at < ?").get(agentsBefore) as { n: number }).n;

  if (!dryRun) {
    tx(() => {
      for (const { id } of expired) {
        conn.prepare("DELETE FROM checkouts WHERE inquiry_id = ?").run(id);
        conn.prepare("DELETE FROM email_outbox WHERE related_id = ?").run(id);
        conn.prepare("DELETE FROM inquiries WHERE id = ?").run(id);
      }
      conn.prepare("DELETE FROM agent_inquiries WHERE created_at < ?").run(agentsBefore);
      // Outbox copies of other messages are only kept for 90 days.
      conn.prepare("DELETE FROM email_outbox WHERE created_at < ?").run(daysAgo(90));
      conn.prepare("DELETE FROM rate_limits WHERE window_start < ?").run(Math.floor(Date.now() / 1000) - 86400);
    });
  }
  return { inquiries: expired.length, agentInquiries: agentCount, dryRun };
}
