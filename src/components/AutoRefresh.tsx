"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-checks the server while a payment confirmation is pending. Stops after about a minute. */
export function AutoRefresh({ intervalMs = 3000, maxTries = 20 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= maxTries) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, intervalMs);
    return () => clearTimeout(t);
  }, [tries, maxTries, intervalMs, router]);
  if (tries >= maxTries) {
    return (
      <p className="mt-4 text-[0.975rem]">
        This is taking longer than usual. You don&apos;t need to pay again. We&apos;ll email you as soon as the payment is confirmed,
        or you can reload this page later.
      </p>
    );
  }
  return null;
}
