import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page py-20">
        <h1 className="text-[2.2rem] font-medium">We couldn&apos;t find that page</h1>
        <p className="mt-4 text-muted">The link may be old or mistyped.</p>
        <p className="mt-6"><Link className="text-link" href="/">Go to the homepage</Link></p>
      </main>
      <SiteFooter />
    </>
  );
}
