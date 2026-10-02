export function Faq({ items }: { items: { q: string; a: string[] }[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1.1rem] font-semibold [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <svg viewBox="0 0 20 20" className="h-5 w-5 flex-none text-evergreen transition-transform group-open:rotate-45" aria-hidden="true">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="space-y-3 pb-6 pr-8 text-muted">
            {item.a.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
