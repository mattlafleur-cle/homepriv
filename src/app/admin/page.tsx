import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { addressLine, type InquiryRow } from "@/lib/eligibility";
import { formatMoney, type OrderRow } from "@/lib/payments";
import { formatDate } from "@/lib/onboarding";
import { funnelSummary } from "@/lib/events";
import { effectiveMode, requestedMode, salesReadiness } from "@/config/site";
import { ApproveForm, DeclineForm, DeleteForm, RefundForm } from "./AdminForms";
import { logoutAction } from "./actions";

export const metadata: Metadata = { title: "Operator", robots: { index: false, follow: false } };

type Outbox = { id: string; template: string; to_address: string; subject: string; text: string; status: string; created_at: string };
type Agent = { id: string; name: string; email: string; brokerage: string | null; message: string | null; created_at: string; is_test: number };

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

function InquiryCard({ i, actions }: { i: InquiryRow; actions?: React.ReactNode }) {
  const links = JSON.parse(i.listing_links) as string[];
  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono font-semibold">{i.ref_code} {i.is_test ? <span className="ml-1 rounded bg-[#fff1c9] px-1.5 text-[0.75rem]">TEST</span> : null}</p>
        <p className="text-[0.8125rem] text-muted">{new Date(i.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })} · {i.status}</p>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-[0.875rem] sm:grid-cols-[9rem_1fr]">
        <dt className="text-muted">Home</dt><dd>{addressLine(i)}</dd>
        <dt className="text-muted">Contact</dt><dd>{i.name} · {i.email}{i.phone ? ` · ${i.phone}` : ""}</dd>
        <dt className="text-muted">Relationship</dt><dd>{i.relationship === "owner" ? "Owner (self-reported)" : "Authorized by owner (self-reported)"}</dd>
        <dt className="text-muted">Listing status</dt><dd>{i.listing_status}</dd>
        {links.length > 0 && (<><dt className="text-muted">Links</dt><dd className="break-all">{links.join(" ")}</dd></>)}
        {i.notes && (<><dt className="text-muted">Notes</dt><dd>{i.notes}</dd></>)}
        <dt className="text-muted">Marketing opt-in</dt><dd>{i.marketing_consent ? "yes" : "no"}</dd>
        {i.decision_note && (<><dt className="text-muted">Decision</dt><dd>{i.decided_by}: {i.decision_note}</dd></>)}
      </dl>
      {actions && <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">{actions}</div>}
    </li>
  );
}

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const pending = await db.all("SELECT * FROM inquiries WHERE status='pending_review' ORDER BY created_at") as InquiryRow[];
  const approved = await db.all("SELECT * FROM inquiries WHERE status='approved' ORDER BY updated_at DESC LIMIT 50") as InquiryRow[];
  const closed = await db.all("SELECT * FROM inquiries WHERE status IN ('declined','listed_not_eligible') ORDER BY updated_at DESC LIMIT 30") as InquiryRow[];
  const orders = await db.all("SELECT o.*, i.name, i.email, i.street, i.unit, i.city, i.state, i.zip FROM orders o JOIN inquiries i ON i.id=o.inquiry_id ORDER BY o.paid_at DESC LIMIT 100") as (OrderRow & Omit<InquiryRow, "status" | "id" | "is_test" | "created_at" | "updated_at">)[];
  const agents = await db.all("SELECT * FROM agent_inquiries ORDER BY created_at DESC LIMIT 30") as Agent[];
  const outbox = await db.all("SELECT * FROM email_outbox ORDER BY created_at DESC LIMIT 25") as Outbox[];
  const funnel = await funnelSummary(effectiveMode() === "preview");
  const readiness = salesReadiness();

  return (
    <main id="main" className="container-page space-y-12 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-medium">Operator</h1>
          <p className="text-muted">Mode: <strong>{effectiveMode()}</strong>{requestedMode() !== effectiveMode() ? ` (requested ${requestedMode()}, locked until setup is complete)` : ""}</p>
        </div>
        <form action={logoutAction}><button className="btn-secondary !min-h-10 !py-2">Sign out</button></form>
      </div>

      <section aria-labelledby="pending-h">
        <h2 id="pending-h" className="text-[1.4rem] font-medium">Waiting for review ({pending.length})</h2>
        {pending.length === 0 ? <p className="mt-2 text-muted">Nothing waiting.</p> : (
          <ul className="mt-4 space-y-4">
            {pending.map((i) => (
              <InquiryCard key={i.id} i={i} actions={<><ApproveForm id={i.id} /><DeclineForm id={i.id} /></>} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="orders-h">
        <h2 id="orders-h" className="text-[1.4rem] font-medium">Orders ({orders.length})</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[48rem] text-left text-[0.875rem]">
            <thead className="bg-sand/60"><tr>{["Order", "Home", "Paid", "Status", "Window ends", "Recheck", "Street View", ""].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line align-top">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-3 py-2 font-mono">{o.order_number}{o.is_test ? " (test)" : ""}</td>
                  <td className="px-3 py-2">{addressLine(o)}<br /><span className="text-muted">{o.name} · {o.email}</span></td>
                  <td className="px-3 py-2">{formatMoney(o.amount_cents)}<br /><span className="text-muted">{formatDate(o.paid_at)} · {o.provider}</span></td>
                  <td className="px-3 py-2">{o.status}{o.authorization_name ? <><br /><span className="text-muted">signed: {o.authorization_name}</span></> : null}</td>
                  <td className="px-3 py-2">{formatDate(o.service_ends_at) || "not started"}</td>
                  <td className="px-3 py-2">{formatDate(o.recheck_at)}</td>
                  <td className="px-3 py-2">{o.street_view_consent ? "consented" : "no"}</td>
                  <td className="px-3 py-2">{o.status !== "refunded" && <RefundForm order={o.order_number} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="approved-h">
        <h2 id="approved-h" className="text-[1.4rem] font-medium">Approved, not yet paid ({approved.length})</h2>
        <ul className="mt-4 space-y-4">
          {approved.map((i) => (
            <InquiryCard key={i.id} i={i} actions={<><ApproveForm id={i.id} label="Send a new link (old link stops working)" /><DeclineForm id={i.id} /></>} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="funnel-h" className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 id="funnel-h" className="text-[1.4rem] font-medium">Funnel{effectiveMode() === "preview" ? " (including test events)" : ""}</h2>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[0.95rem]">
            {["cta_primary_click", "eligibility_started", "eligibility_submitted", "eligibility_approved", "checkout_started", "purchase_confirmed", "agent_inquiry"].map((k) => (
              <div key={k} className="contents"><dt>{k}</dt><dd className="text-right font-mono">{funnel.counts[k] ?? 0}</dd></div>
            ))}
            <dt className="mt-2 font-semibold">Approved to purchased</dt><dd className="mt-2 text-right font-mono">{pct(funnel.eligibilityToPurchase)}</dd>
            <dt>Submitted to approved</dt><dd className="text-right font-mono">{pct(funnel.approvalRate)}</dd>
          </dl>
        </div>
        <div>
          <h2 className="text-[1.4rem] font-medium">Sales readiness</h2>
          <ul className="mt-3 space-y-1 text-[0.95rem]">
            {readiness.map((r) => <li key={r.key}>{r.ok ? "✓" : "✗"} {r.label}</li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="agents-h">
        <h2 id="agents-h" className="text-[1.4rem] font-medium">Agent inquiries ({agents.length})</h2>
        <ul className="mt-3 space-y-2 text-[0.9rem]">
          {agents.map((a) => (
            <li key={a.id} className="rounded-lg border border-line bg-white p-3">
              {a.name} · {a.email}{a.brokerage ? ` · ${a.brokerage}` : ""}{a.is_test ? " (test)" : ""}
              {a.message && <p className="mt-1 text-muted">{a.message}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="closed-h">
        <h2 id="closed-h" className="text-[1.4rem] font-medium">Declined and not eligible</h2>
        <ul className="mt-4 space-y-4">
          {closed.map((i) => <InquiryCard key={i.id} i={i} actions={<DeleteForm id={i.id} />} />)}
        </ul>
      </section>

      <section aria-labelledby="outbox-h">
        <h2 id="outbox-h" className="text-[1.4rem] font-medium">Recent email</h2>
        <p className="text-[0.9rem] text-muted">In preview mode messages are held here and never sent.</p>
        <ul className="mt-3 space-y-2">
          {outbox.map((m) => (
            <li key={m.id} className="rounded-lg border border-line bg-white p-3 text-[0.875rem]">
              <details>
                <summary className="cursor-pointer"><strong>{m.status}</strong> · {m.template} · {m.subject} · to {m.to_address}</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words font-sans">{m.text}</pre>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
