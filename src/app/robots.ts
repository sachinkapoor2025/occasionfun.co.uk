import type { MetadataRoute } from "next";
import { company } from "@/config/company";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const base = company.siteUrl.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
