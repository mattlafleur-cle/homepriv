import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { indexable, siteUrl } from "@/config/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  if (!indexable()) {
    // Preview, interest-without-launch, and unconfigured deployments stay out of search results.
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/c/", "/api/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
