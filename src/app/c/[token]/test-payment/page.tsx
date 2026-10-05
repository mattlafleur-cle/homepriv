import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteChrome";
import { customerByToken, formatMoney, latestCheckout } from "@/lib/payments";
import { paymentProvider } from "@/config/site";
import { offer } from "@/config/offer";

export const metadata: Metadata = { title: "Test payment", robots: { index: false, follow: false } };

export default async function TestPaymentPage(props: PageProps<"/c/[token]/test-payment">) {
  const { token } = await props.params;
  if (paymentProvider() !== "simulated") notFound();
  const found = await customerByToken(token);
  const checkout = found && await latestCheckout(found.inquiry.id);
  if (!found || !checkout || checkout.provider !== "simulated") notFound();

  const action = `/c/${token}/test-payment/complete`;
  return (
    <>
      <SiteHeader showCta={false} />
      <main id="main" className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-lg rounded-[var(--radius-card)] border-2 border-dashed border-[#9a8f78] bg-[#fff8e6] p-6 sm:p-8">
          <p className="eyebrow !text-[#6b5520]">Preview only</p>
          <h1 className="mt-2 text-[1.9rem] font-medium">Test payment</h1>
          <p className="mt-3">
            This stands in for Stripe Checkout while the site is in preview mode. No card details are collected and no money moves.
            In sales mode, customers pay on Stripe&apos;s secure page instead.
          </p>
          <div className="mt-6 rounded-xl bg-white p-4">
            <p className="flex justify-between gap-4">
              <span>{offer.productName}</span>
              <span className="font-semibold">{formatMoney(checkout.amount_cents)}</span>
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <form method="post" action={action}>
              <input type="hidden" name="outcome" value="pay" />
              <button className="btn-primary w-full" type="submit">Complete test payment</button>
            </form>
            <form method="post" action={action}>
              <input type="hidden" name="outcome" value="decline" />
              <button className="btn-secondary w-full" type="submit">Simulate a declined card</button>
            </form>
            <form method="post" action={action}>
              <input type="hidden" name="outcome" value="cancel" />
              <button className="btn-secondary w-full" type="submit">Cancel and go back</button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
