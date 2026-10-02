/**
 * Custom illustrations for the homepage. Everything shown here is fictional
 * and labeled "Illustrative example". No real property or customer outcome.
 */

export function IllustrativeTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-ink/85 px-2.5 py-1 text-[0.75rem] font-semibold tracking-wide text-white ${className}`}
    >
      Illustrative example
    </span>
  );
}

export function InteriorScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 250" className={className} role="img" aria-label="Illustration of a sunlit living room with a sofa, window, rug, and plant">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe5d3" />
          <stop offset="1" stopColor="#e6d8c0" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8a37b" />
          <stop offset="1" stopColor="#b58d63" />
        </linearGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe1e4" />
          <stop offset="1" stopColor="#eaf0e6" />
        </linearGradient>
        <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6e2" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff6e2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#wall)" />
      <rect y="178" width="400" height="72" fill="url(#floor)" />
      {[196, 214, 234].map((y) => (
        <path key={y} d={`M0 ${y}H400`} stroke="#a77f57" strokeOpacity=".35" />
      ))}
      <rect y="174" width="400" height="5" fill="#d9c8ab" />
      {/* window */}
      <rect x="34" y="34" width="112" height="120" rx="3" fill="#f6efe2" />
      <rect x="41" y="41" width="98" height="106" fill="url(#sky)" />
      <path d="M41 120c18-12 34-10 50-2s30 6 48-6v35H41z" fill="#a9c2a6" />
      <path d="M90 41v106M41 94h98" stroke="#f6efe2" strokeWidth="5" />
      <path d="M28 30h124" stroke="#8b6a4c" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 32c6 40 4 80 10 128h-14c2-48 0-88 4-128z" fill="#e9c9a8" />
      <path d="M150 32c-6 40-4 80-10 128h14c-2-48 0-88-4-128z" fill="#e9c9a8" />
      <path d="M146 150 260 250H90L40 150z" fill="url(#light)" />
      {/* art */}
      <rect x="214" y="52" width="70" height="52" rx="2" fill="#f8f3ea" stroke="#8b6a4c" strokeWidth="3" />
      <path d="M222 94l16-20 12 12 10-8 16 16z" fill="#b5643a" opacity=".8" />
      <circle cx="262" cy="68" r="6" fill="#d9a35c" />
      <rect x="296" y="62" width="34" height="42" rx="2" fill="#f8f3ea" stroke="#8b6a4c" strokeWidth="3" />
      <path d="M303 96c6-14 14-20 20-22" stroke="#5e7f6e" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* rug */}
      <ellipse cx="262" cy="212" rx="118" ry="20" fill="#e6d3b5" />
      <ellipse cx="262" cy="212" rx="100" ry="14" fill="none" stroke="#c9a97d" strokeWidth="2" />
      {/* sofa */}
      <rect x="182" y="128" width="166" height="40" rx="12" fill="#466f5d" />
      <rect x="172" y="146" width="186" height="38" rx="12" fill="#3d6352" />
      <rect x="166" y="138" width="24" height="46" rx="10" fill="#36594a" />
      <rect x="340" y="138" width="24" height="46" rx="10" fill="#36594a" />
      <rect x="196" y="134" width="40" height="28" rx="8" fill="#e9c9a8" />
      <rect x="296" y="134" width="40" height="28" rx="8" fill="#f1dcc0" />
      <path d="M180 184v8M350 184v8" stroke="#5b4330" strokeWidth="4" strokeLinecap="round" />
      {/* side table + lamp */}
      <rect x="370" y="150" width="26" height="4" rx="2" fill="#8b6a4c" />
      <path d="M374 154v32M392 154v32" stroke="#8b6a4c" strokeWidth="3" />
      <path d="M376 104h16l6 22h-28z" fill="#f4e2cf" />
      <path d="M384 126v24" stroke="#5b4330" strokeWidth="2.5" />
      {/* plant */}
      <path d="M160 190h-22l3 -24h16z" fill="#b5643a" />
      <path d="M149 166c-12-12-18-28-10-40 6 10 8 24 10 40zm0 0c4-16 12-30 26-34-2 16-12 28-26 34zm0 0c-6-8-20-14-28-10 8 8 18 12 28 10z" fill="#5e7f6e" />
      {/* coffee table */}
      <rect x="220" y="196" width="88" height="8" rx="4" fill="#8b6a4c" />
      <path d="M230 204v10M298 204v10" stroke="#6e523a" strokeWidth="3" />
      <rect x="244" y="188" width="18" height="8" rx="2" fill="#f8f3ea" />
    </svg>
  );
}

export type Status = "removed" | "verified" | "submitted" | "visible";

export const STATUS_META: Record<Status, { label: string; className: string }> = {
  removed: { label: "Verified removed", className: "bg-ok-bg text-ok" },
  verified: { label: "Verified suppressed", className: "bg-ok-bg text-ok" },
  submitted: { label: "Request submitted", className: "bg-wait-bg text-wait" },
  visible: { label: "Still visible", className: "bg-open-bg text-open" },
};

export function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${m.className}`}>
      <StatusIcon status={status} />
      {m.label}
    </span>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "verified" || status === "removed")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "submitted")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 5v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

/** Hero product demonstration: a fictional listing page and a fictional report. */
export function HeroDemo() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem] sm:pb-28 lg:pb-32">
      <figure className="overflow-hidden rounded-[1.25rem] border border-line bg-paper shadow-[0_24px_60px_-28px_rgba(28,38,35,0.45)]">
        <div className="flex items-center gap-2 border-b border-line bg-sand/60 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#d8cbb4]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d8cbb4]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d8cbb4]" />
          </span>
          <span className="ml-2 truncate rounded-md bg-paper px-2.5 py-0.5 text-[0.75rem] text-muted">
            a-property-website.example/sample-home
          </span>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-[0.875rem]">
          <span className="font-semibold">Sample home, sold last year</span>
          <span className="rounded-full bg-sand px-2.5 py-0.5 text-[0.8125rem] font-medium text-muted">Off market, photos still public</span>
        </figcaption>
        <div className="relative">
          <InteriorScene className="block h-auto w-full" />
          <IllustrativeTag className="absolute left-3 top-3" />
          <span className="absolute bottom-3 right-3 rounded-md bg-ink/75 px-2 py-0.5 text-[0.75rem] font-medium text-white">
            Photo 1 of 32
          </span>
        </div>
      </figure>

      <div className="relative z-10 -mt-10 ml-auto w-[94%] rounded-[1.1rem] border border-line bg-white p-4 shadow-[0_20px_50px_-24px_rgba(28,38,35,0.5)] sm:absolute sm:bottom-0 sm:right-0 sm:mt-0 sm:w-[78%] sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[1.05rem] font-semibold leading-tight">Cleanup report</p>
            <p className="text-[0.8125rem] text-muted">Sample home, week 3</p>
          </div>
          <IllustrativeTag className="shrink-0 !bg-sand !text-ink" />
        </div>
        <ul className="divide-y divide-line text-[0.875rem]">
          {(
            [
              ["Listing site A", "verified"],
              ["Original brokerage site", "submitted"],
              ["Image search results", "visible"],
            ] as const
          ).map(([dest, s]) => (
            <li key={dest} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">{dest}</span>
              <StatusPill status={s} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
