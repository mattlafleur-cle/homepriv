export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#1f4a3d" />
      <path d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" fill="none" stroke="#f8f3ea" strokeWidth="2" strokeLinejoin="round" />
      <rect x="13" y="17" width="6" height="5" rx="1" fill="#f8f3ea" />
      <path d="M12.5 19.5h7" stroke="#b5643a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-[1.15rem] font-semibold leading-none tracking-tight text-evergreen">
        Home Privacy <span className="text-clay-ink">Cleanup</span>
      </span>
    </span>
  );
}
