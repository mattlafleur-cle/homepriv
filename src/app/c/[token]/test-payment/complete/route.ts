import { completeSimulatedPayment } from "@/lib/payments";
import { siteUrl } from "@/config/site";

/** Preview-only simulated payment. Refuses to run unless the payment provider is "simulated". */
export async function POST(request: Request, ctx: RouteContext<"/c/[token]/test-payment/complete">) {
  const { token } = await ctx.params;
  const form = await request.formData();
  const outcome = form.get("outcome");
  const base = `${siteUrl()}/c/${encodeURIComponent(token)}`;
  if (outcome !== "pay" && outcome !== "cancel" && outcome !== "decline") return Response.redirect(base, 303);
  try {
    const r = await completeSimulatedPayment(token, outcome);
    if (r.status === "canceled") return Response.redirect(`${base}?canceled=1`, 303);
    if (r.status === "failed") return Response.redirect(`${base}?error=payment_failed`, 303);
    return Response.redirect(`${base}?returned=1`, 303);
  } catch {
    return Response.redirect(`${base}?error=checkout_failed`, 303);
  }
}
