"use client";

import { useEffect, useState } from "react";
import { CtaLink } from "./CtaLink";

/**
 * Phone-only bottom bar. It appears after the hero buttons scroll away and
 * hides while the final call to action is on screen. A spacer of the same
 * height keeps it from covering the footer.
 */
export function StickyCta({ label }: { label: string }) {
  const [heroGone, setHeroGone] = useState(false);
  const [finalVisible, setFinalVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const final = document.getElementById("final-cta");
    if (!hero || !("IntersectionObserver" in window)) return;
    const heroObs = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0));
    heroObs.observe(hero);
    const finalObs = new IntersectionObserver(([e]) => setFinalVisible(e.isIntersecting), { threshold: 0.2 });
    if (final) finalObs.observe(final);
    return () => {
      heroObs.disconnect();
      finalObs.disconnect();
    };
  }, []);

  const show = heroGone && !finalVisible;

  return (
    <>
      <div className="h-[5.25rem] sm:hidden" aria-hidden="true" />
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ivory/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm transition-transform duration-200 sm:hidden ${
          show ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
        aria-hidden={!show}
        inert={!show}
      >
        <CtaLink location="sticky" className="btn-primary w-full">
          {label}
        </CtaLink>
      </div>
    </>
  );
}
