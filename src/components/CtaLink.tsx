"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** Sends an anonymous click count (event name and page location only). */
export function sendEvent(name: string, location?: string) {
  try {
    const body = JSON.stringify({ name, location });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    /* counting must never block the visitor */
  }
}

export function CtaLink({
  location,
  children,
  className = "btn-primary",
}: {
  location: "header" | "hero" | "pricing" | "final" | "sticky" | "faq" | "steps";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href="/start" className={className} onClick={() => sendEvent("cta_primary_click", location)}>
      {children}
    </Link>
  );
}
