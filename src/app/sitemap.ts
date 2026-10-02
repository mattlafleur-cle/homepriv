import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { indexable, siteUrl } from "@/config/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  if (!indexable()) return [];
  const base = siteUrl();
  return ["", "/start", "/scope", "/refunds", "/privacy", "/terms"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.5,
  }));
}
