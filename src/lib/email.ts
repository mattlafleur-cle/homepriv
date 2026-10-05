import "server-only";
import { db, nowIso } from "./db";
import { newId } from "./tokens";
import { contact, effectiveMode, emailConfig, siteUrl } from "@/config/site";
import { offer } from "@/config/offer";

/**
 * Transactional email. Every message is written to the outbox table first.
 * In preview mode nothing is sent (the operator can read messages in /admin).
 * In interest and sales modes messages go out through Resend when configured.
 * Errors are recorded without logging recipient details.
 */

export type EmailMessage = {
  template: string;
  to: string;
  subject: string;
  /** Plain paragraphs. A paragraph starting with "* " becomes a list item. */
  paragraphs: string[];
  button?: { label: string; url: string };
  relatedId?: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function footerLines() {
  const c = contact();
  const lines: string[] = [offer.brandName];
  if (c.legalName && c.legalName !== offer.brandName) lines.push(c.legalName);
  if (c.mailingAddress) lines.push(c.mailingAddress);
  if (c.email) lines.push(c.email);
  return lines;
}

export function renderEmail(msg: EmailMessage) {
  const blocks: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        `<ul style="margin:0 0 16px;padding-left:20px;color:#1d2a26;font-size:16px;line-height:1.55">${list
          .map((li) => `<li style="margin:0 0 6px">${esc(li)}</li>`)
          .join("")}</ul>`,
      );
      list = [];
    }
  };
  for (const p of msg.paragraphs) {
    if (p.startsWith("* ")) {
      list.push(p.slice(2));
      continue;
    }
    flush();
    blocks.push(`<p style="margin:0 0 16px;color:#1d2a26;font-size:16px;line-height:1.55">${esc(p)}</p>`);
  }
  flush();
  if (msg.button) {
    blocks.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:#1f4a3d;border-radius:8px"><a href="${esc(
        msg.button.url,
      )}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none">${esc(
        msg.button.label,
      )}</a></td></tr></table><p style="margin:0 0 16px;color:#4b5a55;font-size:14px;line-height:1.5">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${esc(
        msg.button.url,
      )}</span></p>`,
    );
  }

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(
    msg.subject,
  )}</title></head><body style="margin:0;padding:0;background:#f7f2e8"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2e8"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;font-family:Helvetica,Arial,sans-serif"><tr><td style="padding:28px 28px 8px;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1f4a3d;font-weight:600">${esc(
    offer.brandName,
  )}</td></tr><tr><td style="padding:12px 28px 12px">${blocks.join(
    "",
  )}</td></tr><tr><td style="padding:16px 28px 28px;border-top:1px solid #ece4d4;color:#5c6a65;font-size:13px;line-height:1.5">${footerLines()
    .map(esc)
    .join("<br>")}</td></tr></table></td></tr></table></body></html>`;

  const text = [
    ...msg.paragraphs.map((p) => (p.startsWith("* ") ? `- ${p.slice(2)}` : p)),
    ...(msg.button ? [`${msg.button.label}: ${msg.button.url}`] : []),
    "",
    "--",
    ...footerLines(),
  ].join("\n\n");

  return { html, text };
}

export async function sendEmail(msg: EmailMessage) {
  const { html, text } = renderEmail(msg);
  const id = newId();
  const mode = effectiveMode();
  const cfg = emailConfig();
  const canSend = mode !== "preview" && Boolean(cfg.resendApiKey && cfg.from);
  const status = mode === "preview" ? "held_preview" : canSend ? "queued" : "not_configured";

  await db.run("INSERT INTO email_outbox(id, template, to_address, subject, html, text, status, provider, related_id, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)", id, msg.template, msg.to, msg.subject, html, text, status, canSend ? "resend" : "outbox", msg.relatedId ?? null, nowIso());

  if (!canSend) return { id, status };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: cfg.from,
        to: [msg.to],
        subject: msg.subject,
        html,
        text,
        ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await db.run("UPDATE email_outbox SET status='sent', sent_at=? WHERE id=?", nowIso(), id);
    return { id, status: "sent" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    await db.run("UPDATE email_outbox SET status='failed', error=? WHERE id=?", reason, id);
    console.error(`[email] ${msg.template} ${id} failed: ${reason}`);
    return { id, status: "failed" };
  }
}

/** Notify the operator without putting customer details in the subject line. */
export async function notifyOperator(subject: string, paragraphs: string[], relatedId?: string) {
  const to = contact().email;
  if (!to) return;
  await sendEmail({
    template: "operator_notice",
    to,
    subject,
    paragraphs: [...paragraphs, `Review in the admin area: ${siteUrl()}/admin`],
    relatedId,
  });
}
