/**
 * Operator command line. Usage: npm run ops -- <command> [args]
 *
 *   list [status]                 List inquiries (default: pending_review)
 *   show <ref>                    Show one inquiry
 *   approve <ref> [note]          Approve and email a secure checkout link
 *   decline <ref> <reason> [note] Decline (reasons: listed, no_exposure, out_of_area, other)
 *   refund <order> <reason>       Refund an order (issues the Stripe refund for Stripe payments)
 *   delete <ref>                  Permanently delete an unpaid inquiry
 *   purge [--dry-run]             Apply the retention periods in src/config/offer.ts
 *   funnel                        Funnel counts and eligibility-to-purchase conversion
 *   readiness                     What sales mode still needs
 */
import { db } from "@/lib/db";
import { addressLine, approveInquiry, declineInquiry, deleteInquiry, DECLINE_REASONS, findInquiry, type DeclineReason, type InquiryRow } from "@/lib/eligibility";
import { refundOrder } from "@/lib/payments";
import { funnelSummary } from "@/lib/events";
import { purgeExpired } from "@/lib/retention";
import { contact, effectiveMode, salesReadiness } from "@/config/site";

const [cmd, ...args] = process.argv.slice(2);
const operator = contact().operatorName ?? "cli";

function row(i: InquiryRow) {
  return `${i.ref_code}  ${i.status.padEnd(20)} ${i.is_test ? "[test] " : ""}${addressLine(i)}  (${i.created_at.slice(0, 10)})`;
}

async function main() {
  switch (cmd) {
    case "list": {
      const status = args[0] ?? "pending_review";
      const rows = db().prepare("SELECT * FROM inquiries WHERE status = ? ORDER BY created_at").all(status) as InquiryRow[];
      console.log(rows.length ? rows.map(row).join("\n") : `No inquiries with status ${status}.`);
      break;
    }
    case "show": {
      const i = findInquiry(args[0] ?? "");
      if (!i) throw new Error("Not found");
      console.log({ ...i, listing_links: JSON.parse(i.listing_links) });
      break;
    }
    case "approve": {
      const r = await approveInquiry(args[0] ?? "", operator, args.slice(1).join(" ") || undefined);
      console.log(`Approved ${r.refCode}. Customer link (also emailed):\n${r.link}`);
      break;
    }
    case "decline": {
      const reason = args[1] as DeclineReason;
      if (!(reason in DECLINE_REASONS)) throw new Error(`Reason must be one of: ${Object.keys(DECLINE_REASONS).join(", ")}`);
      const r = await declineInquiry(args[0] ?? "", operator, reason, args.slice(2).join(" ") || undefined);
      console.log(`Declined ${r.refCode}.`);
      break;
    }
    case "refund": {
      const o = await refundOrder(args[0] ?? "", args.slice(1).join(" ") || "operator refund");
      console.log(`Order ${o.order_number} is now ${o.status}.`);
      break;
    }
    case "delete": {
      console.log(deleteInquiry(args[0] ?? "") ? "Deleted." : "Not found.");
      break;
    }
    case "purge": {
      const r = purgeExpired({ dryRun: args.includes("--dry-run") });
      console.log(r);
      break;
    }
    case "funnel": {
      const f = funnelSummary(args.includes("--include-test"));
      console.log(f.counts);
      console.log(`Submitted to approved: ${f.approvalRate === null ? "n/a" : (f.approvalRate * 100).toFixed(1) + "%"}`);
      console.log(`Approved to purchased: ${f.eligibilityToPurchase === null ? "n/a" : (f.eligibilityToPurchase * 100).toFixed(1) + "%"}`);
      const refunds = db().prepare("SELECT COUNT(*) n FROM orders WHERE status='refunded' AND is_test=0").get() as { n: number };
      const paid = db().prepare("SELECT COUNT(*) n FROM orders WHERE is_test=0").get() as { n: number };
      console.log(`Refunded orders: ${refunds.n} of ${paid.n}`);
      break;
    }
    case "readiness": {
      console.log(`Effective mode: ${effectiveMode()}`);
      for (const r of salesReadiness()) console.log(`${r.ok ? "ready  " : "MISSING"}  ${r.label}`);
      break;
    }
    default:
      console.log("Commands: list, show, approve, decline, refund, delete, purge, funnel, readiness. See scripts/ops.ts.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
