import { describe, expect, it } from "vitest";
import { mainNav, footerNav, legalNav } from "@/config/navigation";
import { getAllServiceSlugs, getServiceBySlug } from "@/content/services";
import { company, getUnresolvedPlaceholders } from "@/config/company";

const expectedPaths = [
  "/",
  "/about",
  "/services",
  "/public-sector",
  "/technology-partner",
  "/how-we-work",
  "/trust",
  "/contact",
  "/policies",
  "/privacy",
  "/cookies",
  "/terms",
];

describe("critical routes and content integrity", () => {
  it("exposes the required primary navigation destinations", () => {
    const hrefs = mainNav.map((item) => item.href);
    for (const path of [
      "/",
      "/about",
      "/services",
      "/public-sector",
      "/technology-partner",
      "/how-we-work",
      "/trust",
      "/contact",
    ]) {
      expect(hrefs).toContain(path);
    }
  });

  it("keeps legal and policy links available in footer navigation", () => {
    const hrefs = [...footerNav, ...legalNav].map((item) => item.href);
    expect(hrefs).toEqual(expect.arrayContaining(["/privacy", "/cookies", "/terms", "/policies"]));
  });

  it("defines all expected top-level paths for sitemap coverage checks", () => {
    expect(expectedPaths.length).toBeGreaterThanOrEqual(12);
  });

  it("has eight service pages with resolvable slugs", () => {
    const slugs = getAllServiceSlugs();
    expect(slugs).toHaveLength(8);
    for (const slug of slugs) {
      expect(getServiceBySlug(slug)?.title).toBeTruthy();
    }
  });

  it("keeps verified company identity consistent", () => {
    expect(company.legalName).toBe("OCCASIONFUN LTD");
    expect(company.companyNumber).toBe("17427098");
    expect(company.jurisdiction).toBe("United Kingdom");
  });

  it("tracks unresolved placeholders explicitly", () => {
    const unresolved = getUnresolvedPlaceholders();
    expect(unresolved.length).toBeGreaterThan(0);
    expect(unresolved.every((item) => item.value.includes("[INSERT"))).toBe(
      true,
    );
  });
});
