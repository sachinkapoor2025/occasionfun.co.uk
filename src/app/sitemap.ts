import type { MetadataRoute } from "next";
import { company } from "@/config/company";
import { getAllServiceSlugs } from "@/content/services";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = company.siteUrl.replace(/\/$/, "");

  const staticRoutes = [
    "",
    "/about",
    "/services",
    "/public-sector",
    "/technology-partner",
    "/how-we-work",
    "/trust",
    "/policies",
    "/contact",
    "/privacy",
    "/cookies",
    "/terms",
  ];

  const serviceRoutes = getAllServiceSlugs().map(
    (slug) => `/services/${slug}`,
  );

  return [...staticRoutes, ...serviceRoutes].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path.startsWith("/services") ? "monthly" : "weekly",
    priority: path === "" ? 1 : path === "/contact" ? 0.9 : 0.7,
  }));
}
