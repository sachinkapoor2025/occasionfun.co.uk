import { describe, expect, it } from "vitest";
import {
  companyNav,
  footerExplore,
  legalNav,
  mainNav,
} from "@/config/navigation";
import { digitalProjects } from "@/content/projects";
import {
  getAllServiceSlugs,
  getRelatedServices,
  getServiceBySlug,
  serviceGroups,
} from "@/content/services";
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
      "/contact",
    ]);
    expect(companyNav.map((item) => item.href)).toEqual([
      "/about",
      "/technology-partner",
      "/how-we-work",
    ]);
  });

  it("keeps legal and policy links in the legal group only", () => {
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

  it("lists four selected digital projects with absolute website links", () => {
    expect(digitalProjects.map((project) => project.name)).toEqual([
      "UsaRakhi.com",
      "BlossomPot.com",
      "HalloweenReady.com",
      "SpicyCenter.com",
    ]);
    expect(digitalProjects.map((project) => project.href)).toEqual([
      "https://usarakhi.com",
      "https://blossompot.com",
      "https://halloweenready.com",
      "https://spicycenter.com",
    ]);
    for (const project of digitalProjects) {
      expect(project.href).not.toMatch(/\s/);
      expect(project.image.startsWith("/work/")).toBe(true);
      expect(project.alt.length).toBeGreaterThan(20);
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
