import { SiteFooter, SiteHeader } from "./SiteChrome";
import { termsConfirmed } from "@/config/offer";

export function LegalPage({ title, intro, children, alwaysFinal = false }: { title: string; intro?: string; children: React.ReactNode; alwaysFinal?: boolean }) {
  const draft = !alwaysFinal && !termsConfirmed();
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page py-10 md:py-16">
        <article className="mx-auto max-w-3xl">
          {draft && (
            <p role="note" className="mb-6 rounded-xl border-l-4 border-wait bg-wait-bg/70 p-4 text-[0.975rem]">
              <strong>Draft for review.</strong> This page has not been finalized. The final version will be published before paid
              ordering opens, and it will apply to every order.
            </p>
          )}
          <h1 className="text-[2.2rem] font-medium sm:text-[2.6rem]">{title}</h1>
          {intro && <p className="mt-4 text-[1.1rem] text-muted">{intro}</p>}
          <div className="prose-legal mt-8">{children}</div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
