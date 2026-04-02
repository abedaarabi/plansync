import type { MetadataRoute } from "next";
import { getSiteOriginFromRequest } from "@/lib/siteUrl";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getSiteOriginFromRequest();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
