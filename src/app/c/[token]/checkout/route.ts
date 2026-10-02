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
    if (!(err instanceof CheckoutUnavailable)) console.error(`[checkout] start failed: ${err instanceof Error ? err.name : "unknown"}`);
    return Response.redirect(`${siteUrl()}/c/${encodeURIComponent(token)}?error=${code}`, 303);
  }
}
