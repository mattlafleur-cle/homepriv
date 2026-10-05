"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkPassword, endAdminSession, isAdmin, startAdminSession, adminEnabled } from "@/lib/admin-auth";
import { approveInquiry, declineInquiry, deleteInquiry, DECLINE_REASONS, type DeclineReason } from "@/lib/eligibility";
import { refundOrder } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/guard";
import { contact } from "@/config/site";

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
  return contact().operatorName ?? "operator";
}

export async function loginAction(_prev: { error?: string } | undefined, form: FormData) {
  if (!adminEnabled()) return { error: "Admin access is not configured. Set ADMIN_PASSWORD and SESSION_SECRET." };
  const ip = clientIp(await headers());
  if (!(await rateLimit("admin-login", ip, 8, 900))) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const pw = String(form.get("password") ?? "");
  if (!checkPassword(pw)) return { error: "That password isn't right." };
  await startAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await endAdminSession();
  redirect("/admin/login");
}

export type ActionResult = { ok?: string; error?: string; link?: string };

export async function approveAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const by = await requireAdmin();
  try {
    const r = await approveInquiry(String(form.get("id")), by, String(form.get("note") ?? "") || undefined);
    revalidatePath("/admin");
    return { ok: `Approved ${r.refCode}. The customer was emailed this link:`, link: r.link };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not approve" };
  }
}

export async function declineAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const by = await requireAdmin();
  const reason = String(form.get("reason")) as DeclineReason;
  if (!(reason in DECLINE_REASONS)) return { error: "Choose a reason" };
  try {
    const r = await declineInquiry(String(form.get("id")), by, reason, String(form.get("note") ?? "") || undefined);
    revalidatePath("/admin");
    return { ok: `Declined ${r.refCode}. The customer was emailed.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not decline" };
  }
}

export async function refundAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) return { error: "Enter a refund reason" };
  try {
    const o = await refundOrder(String(form.get("order")), reason);
    revalidatePath("/admin");
    return { ok: `Order ${o.order_number} marked refunded.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not refund" };
  }
}

export async function deleteAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (form.get("confirm") !== "DELETE") return { error: 'Type DELETE to confirm' };
  try {
    await deleteInquiry(String(form.get("id")));
    revalidatePath("/admin");
    return { ok: "Deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not delete" };
  }
}
