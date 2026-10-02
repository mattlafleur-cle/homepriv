import Link from "next/link";
import { Logo } from "./Logo";
import { CtaLink } from "./CtaLink";
import { contact, effectiveMode, isProduction, modeCopy, requestedMode, salesReadiness } from "@/config/site";
import { offer } from "@/config/offer";

export function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  const { primaryCta } = modeCopy();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/95 backdrop-blur-sm">
      <div className="container-page flex h-16 items-center justify-between gap-4 md:h-[4.5rem]">
        <Link href="/" className="rounded-md" aria-label={`${offer.brandName} home`}>
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6">
          <ul className="hidden items-center gap-6 text-[0.975rem] font-medium md:flex">
            <li>
              <Link href="/#how-it-works" className="hover:text-evergreen">How it works</Link>
            </li>
            <li>
              <Link href="/#pricing" className="hover:text-evergreen">Pricing</Link>
            </li>
            <li>
              <Link href="/#faq" className="hover:text-evergreen">FAQ</Link>
            </li>
          </ul>
          {showCta && (
            <CtaLink location="header" className="btn-primary !hidden !min-h-[2.75rem] !px-4 !py-2 !text-[0.95rem] sm:!inline-flex">
              {primaryCta}
            </CtaLink>
          )}
        </nav>
      </div>
    </header>
  );
}

export function ModeBanner() {
  const mode = effectiveMode();
  if (mode === "preview") {
    return (
      <div role="note" className="bg-[#2b2f2d] px-4 py-2 text-center text-[0.875rem] text-white">
        <strong className="font-semibold">Preview site.</strong> Test data and test payments only. No real orders are taken.
      </div>
    );
  }
  if (mode === "interest") {
    return (
      <div role="note" className="bg-evergreen px-4 py-2 text-center text-[0.875rem] text-white">
        Paid ordering isn&apos;t open yet. You can still check whether your home qualifies.
      </div>
    );
  }
  return null;
}

/** Shown only in local development so the operator sees why sales mode is locked. */
export function DevStatus() {
  if (isProduction()) return null;
  const requested = requestedMode();
  const mode = effectiveMode();
  const items = salesReadiness();
  const missing = items.filter((i) => !i.ok);
  return (
    <details className="border-b border-dashed border-[#9a8f78] bg-[#fff8e6] px-4 py-1.5 text-[0.8125rem] text-[#4a3f28]">
      <summary className="cursor-pointer">
        Development status: running in <strong>{mode}</strong> mode
        {requested !== mode ? ` (requested ${requested}; sales is locked until setup is complete)` : ""}.{" "}
        {missing.length ? `${missing.length} sales requirement${missing.length === 1 ? "" : "s"} missing.` : "All sales requirements met."}
      </summary>
      <ul className="mt-1 mb-1 list-disc pl-6">
        {items.map((i) => (
          <li key={i.key}>
            {i.ok ? "Ready" : "Missing"}: {i.label}
          </li>
        ))}
      </ul>
      <p className="mb-1">See docs/LAUNCH_CHECKLIST.md. This bar never appears in production builds.</p>
    </details>
  );
}

export function SiteFooter() {
  const c = contact();
  const mode = effectiveMode();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-sand/50">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-[0.95rem] text-muted">
            We help homeowners get old listing photos, floor plans, and virtual tours taken down or hidden from public property
            websites. Starting with homes in {offer.serviceArea}.
          </p>
        </div>
        <div>
          <h2 className="font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-muted">Contact</h2>
          <ul className="mt-3 space-y-2 text-[0.95rem]">
            {c.email ? (
              <li>
                <a className="text-link" href={`mailto:${c.email}`}>{c.email}</a>
              </li>
            ) : (
              <li className="text-muted">
                {mode === "preview" ? "Contact details will be added before launch." : "Reply to any email from us to reach a person."}
              </li>
            )}
            {c.phone && (
              <li>
                <a className="text-link" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>
              </li>
            )}
            {c.mailingAddress && <li className="text-muted">{c.mailingAddress}</li>}
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-muted">Details</h2>
          <ul className="mt-3 space-y-2 text-[0.95rem]">
            <li><Link className="text-link" href="/scope">What&apos;s covered</Link></li>
            <li><Link className="text-link" href="/refunds">Refund policy</Link></li>
            <li><Link className="text-link" href="/privacy">Privacy</Link></li>
            <li><Link className="text-link" href="/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-page border-t border-line py-6 text-[0.8125rem] text-muted">
        <p>
          © {year} {c.legalName ?? offer.brandName}. Zillow, Redfin, Realtor.com, Trulia, Homes.com, and Google are named only as
          websites where listing content can appear. {offer.brandName} is not affiliated with, endorsed by, or a partner of any of
          them.
        </p>
      </div>
    </footer>
  );
}
