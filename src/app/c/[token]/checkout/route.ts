import { CheckoutUnavailable, startCheckout } from "@/lib/payments";
import { siteUrl } from "@/config/site";

export async function POST(_request: Request, ctx: RouteContext<"/c/[token]/checkout">) {
  const { token } = await ctx.params;
  try {
    const { redirectTo } = await startCheckout(token);
    const target = redirectTo.startsWith("http") ? redirectTo : `${siteUrl()}${redirectTo}`;
    return Response.redirect(target, 303);
  } catch (err) {
    const code = err instanceof CheckoutUnavailable ? err.message : "checkout_failed";
    if (!(err instanceof CheckoutUnavailable)) {
      // Stripe error type, code, and parameter name only. Never the message, which can echo request data.
      const e = err as { name?: string; type?: string; code?: string; param?: string; statusCode?: number };
      console.error(`[checkout] start failed: ${e.name ?? "unknown"} type=${e.type ?? "-"} code=${e.code ?? "-"} param=${e.param ?? "-"} status=${e.statusCode ?? "-"}`);
    }
    return Response.redirect(`${siteUrl()}/c/${encodeURIComponent(token)}?error=${code}`, 303);
  }
}
