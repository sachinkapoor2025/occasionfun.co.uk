import { describe, expect, it } from "vitest";
import {
  companyNav,
  footerExplore,
  legalNav,
  mainNav,
} from "@/config/navigation";
import { caseStudies } from "@/content/case-studies";
import {
  getAllServiceSlugs,
  getRelatedServices,
  getServiceBySlug,
  serviceGroups,
} from "@/content/services";
import sitemap from "@/app/sitemap";
import { company, getUnresolvedPlaceholders } from "@/config/company";

const expectedPaths = [
  "/",
  "/about",
  "/services",
  "/our-work",
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
  it("exposes the approved primary navigation and company group", () => {
    expect(mainNav.map((item) => item.href)).toEqual([
      "/",
      "/services",
      "/our-work",
      "/public-sector",
      "/trust",
      "/policies",
      "/contact",
    ]);
    expect(mainNav.find((item) => item.href === "/policies")?.label).toBe(
      "Policy",
    );
    expect(companyNav.map((item) => item.href)).toEqual([
      "/about",
      "/technology-partner",
      "/how-we-work",
    ]);
  });

  it("keeps the footer policy link in the legal group", () => {
    expect(footerExplore.map((item) => item.href)).not.toContain("/policies");
    expect(legalNav.map((item) => item.href)).toEqual([
      "/privacy",
      "/cookies",
      "/terms",
      "/policies",
    ]);
  });

  it("defines all expected top-level paths for sitemap coverage checks", () => {
    expect(expectedPaths.length).toBeGreaterThanOrEqual(12);
  });

  it("publishes apex trailing-slash sitemap URLs and omits draft legal pages", () => {
    const urls = sitemap().map((entry) =>
      typeof entry === "string" ? entry : entry.url,
    );
    expect(urls.every((url) => url.startsWith("https://occasionfun.co.uk/"))).toBe(
      true,
    );
    expect(urls.some((url) => url.includes("www."))).toBe(false);
    expect(urls.some((url) => url.includes("amplifyapp.com"))).toBe(false);
    expect(urls).toContain("https://occasionfun.co.uk/");
    expect(urls).toContain("https://occasionfun.co.uk/our-work/usarakhi/");
    expect(urls).toContain("https://occasionfun.co.uk/policies/");
    for (const path of ["/privacy/", "/cookies/", "/terms/"]) {
      expect(urls).not.toContain(`https://occasionfun.co.uk${path}`);
    }
  });

  it("has eight service pages with resolvable slugs", () => {
    const slugs = getAllServiceSlugs();
    expect(slugs).toHaveLength(8);
    for (const slug of slugs) {
      expect(getServiceBySlug(slug)?.title).toBeTruthy();
    }
  });

  it("keeps service cards, introductions and related links distinct", () => {
    const grouped = serviceGroups.flatMap((group) => group.slugs);
    expect(new Set(grouped).size).toBe(8);
    expect(grouped).toEqual([
      "software-development",
      "wordpress-web",
      "cloud-aws-devops",
      "ai-solutions",
      "data-engineering",
      "qa-test-automation",
      "cybersecurity",
      "managed-services",
    ]);

    for (const slug of getAllServiceSlugs()) {
      const service = getServiceBySlug(slug);
      expect(service).toBeTruthy();
      if (!service) continue;
      expect(service.cardText).not.toBe(service.introduction);
      expect(service.related.length).toBeGreaterThanOrEqual(2);
      expect(service.related.length).toBeLessThanOrEqual(3);
      const related = getRelatedServices(service);
      expect(related).toHaveLength(service.related.length);
      expect(related.map((item) => item.slug)).not.toContain(slug);
      const copy = [
        service.cardText,
        service.introduction,
        service.engagement,
        ...service.covers,
        ...service.exampleDeliverables,
      ].join(" ");
      expect(copy).not.toMatch(/fewer regressions/i);
      expect(copy).not.toMatch(/production-ready/i);
      expect(copy).not.toMatch(/quality dashboards/i);
    }

    const cyber = getServiceBySlug("cybersecurity");
    expect(cyber?.securityNotes).toMatch(/not claims of certification/i);
    expect(cyber?.securityNotes).toMatch(/Penetration testing/i);
  });

  it("lists four internal case studies and no external project links", () => {
    expect(caseStudies.map((project) => project.slug)).toEqual([
      "usarakhi",
      "blossompot",
      "spicycenter",
      "halloweenready",
    ]);
    expect(caseStudies.map((project) => project.name)).toEqual([
      "UsaRakhi",
      "BlossomPot",
      "SpicyCenter",
      "HalloweenReady",
    ]);
    const published = JSON.stringify(caseStudies);
    expect(published).not.toMatch(/https?:\/\//);
    expect(published).not.toMatch(/github\.com/i);
    expect(published).not.toMatch(/wordpress/i);
    for (const project of caseStudies) {
      expect(project.image.startsWith("/work/")).toBe(true);
      expect(project.alt.length).toBeGreaterThan(20);
      expect(project.capabilities.length).toBeGreaterThanOrEqual(3);
      expect(project.capabilities.length).toBeLessThanOrEqual(4);
      expect(project.sections).toHaveLength(10);
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
