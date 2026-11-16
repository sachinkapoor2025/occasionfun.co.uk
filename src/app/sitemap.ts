import type { MetadataRoute } from "next";
import { company } from "@/config/company";
import { getAllCaseStudySlugs } from "@/content/case-studies";
import { getAllServiceSlugs } from "@/content/services";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = company.siteUrl.replace(/\/$/, "");

  const staticRoutes = [
    "/",
    "/about/",
    "/services/",
    "/our-work/",
    "/public-sector/",
    "/technology-partner/",
    "/how-we-work/",
    "/trust/",
    "/contact/",
  ];

  const serviceRoutes = getAllServiceSlugs().map(
    (slug) => `/services/${slug}/`,
  );
  const caseStudyRoutes = getAllCaseStudySlugs().map(
    (slug) => `/our-work/${slug}/`,
  );

  return [...staticRoutes, ...serviceRoutes, ...caseStudyRoutes].map((path) => ({
    url: `${base}${path}`,
    changeFrequency:
      path.startsWith("/services/") ||
      (path.startsWith("/our-work/") && path !== "/our-work/")
        ? "monthly"
        : "weekly",
    priority: path === "/" ? 1 : path === "/contact/" ? 0.9 : 0.7,
  }));
}
