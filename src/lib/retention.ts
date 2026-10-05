import "server-only";
import { db, tx } from "./db";
import { offer } from "@/config/offer";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

/**
 * Delete records past the retention periods published on the privacy page.
 * Paid orders and their inquiries are business records and are not touched.
 * Run daily, e.g. from cron: npm run ops -- purge
 */
export async function purgeExpired({ dryRun = false } = {}) {
  const declinedBefore = daysAgo(offer.retention.declinedInquiryDays);
  const unpaidBefore = daysAgo(offer.retention.unpaidApprovedInquiryDays);
  const agentsBefore = daysAgo(offer.retention.agentInquiryDays);

  const expired = await db.all(`SELECT id FROM inquiries WHERE
        (status IN ('declined','listed_not_eligible') AND updated_at < ?)
        OR (status IN ('approved','pending_review') AND updated_at < ?)`, declinedBefore, unpaidBefore) as { id: string }[];
  const agentCount = (await db.get("SELECT COUNT(*) n FROM agent_inquiries WHERE created_at < ?", agentsBefore) as { n: number }).n;

  if (!dryRun) {
    await tx(async (q) => {
      for (const { id } of expired) {
        await q.run("DELETE FROM checkouts WHERE inquiry_id = ?", id);
        await q.run("DELETE FROM email_outbox WHERE related_id = ?", id);
        await q.run("DELETE FROM inquiries WHERE id = ?", id);
      }
      await q.run("DELETE FROM agent_inquiries WHERE created_at < ?", agentsBefore);
      // Outbox copies of other messages are only kept for 90 days.
      await q.run("DELETE FROM email_outbox WHERE created_at < ?", daysAgo(90));
      await q.run("DELETE FROM rate_limits WHERE window_start < ?", Math.floor(Date.now() / 1000) - 86400);
    });
  }
  return { inquiries: expired.length, agentInquiries: agentCount, dryRun };
}
