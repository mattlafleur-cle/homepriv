import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/inter/index.css";
import "./globals.css";
import { DevStatus, ModeBanner } from "@/components/SiteChrome";
import { indexable, siteUrl } from "@/config/site";
import { offer } from "@/config/offer";

const description = `Old listing photos, floor plans, and virtual tours can stay public after your home leaves the market. We find them, request removal, follow up, and verify the results. ${offer.priceLabel} once for one home.`;

export async function generateMetadata(): Promise<Metadata> {
  // Launch mode and contact details come from the environment at request time,
  // so switching modes needs a restart, not a rebuild.
  await connection();
  const canIndex = indexable();
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: `${offer.brandName}: old listing photos, handled for you`,
      template: `%s | ${offer.brandName}`,
    },
    description,
    applicationName: offer.brandName,
    robots: canIndex ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: offer.brandName,
      title: "Your home is off the market. Its photos may still be online.",
      description,
      url: "/",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: "Your home is off the market. Its photos may still be online.",
      description,
    },
    formatDetection: { telephone: false, address: false, email: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#f8f3ea",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold"
        >
          Skip to main content
        </a>
        <DevStatus />
        <ModeBanner />
        {children}
      </body>
    </html>
  );
}
