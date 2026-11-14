/**
 * Central company configuration.
 * Placeholders use the [INSERT ...] convention and must be replaced
 * with verified values before production launch.
 */

export const PLACEHOLDER_PREFIX = "[INSERT";

export const company = {
  legalName: "OCCASIONFUN LTD",
  tradingName: "OCCASIONFUN LTD",
  companyNumber: "17427098",
  jurisdiction: "United Kingdom",
  registeredOffice: "[INSERT VERIFIED REGISTERED OFFICE ADDRESS]",
  businessEmail: "[INSERT VERIFIED BUSINESS EMAIL]",
  businessPhone: "[INSERT APPROVED BUSINESS PHONE]",
  domain: "[INSERT VERIFIED WEBSITE DOMAIN]",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://occasionfun.co.uk",
  ukRepresentativeName: "[INSERT APPROVED NAME]",
  ukRepresentativeRole: "[INSERT APPROVED ROLE]",
  ukItProfessionalNote:
    "A UK-based IT professional forms part of the current operating setup. Named details will be published only after company approval.",
  dgvDisplayName: "DGV",
  dgvLegalName: "[INSERT DGV FULL LEGAL NAME]",
  dgvCountry: "[INSERT VERIFIED COUNTRY OF REGISTRATION]",
  dgvRegisteredAddress: "[INSERT VERIFIED DGV REGISTERED ADDRESS]",
  dgvWebsite: "[INSERT APPROVED DGV WEBSITE IF ANY]",
  privacyEmail: "[INSERT VERIFIED PRIVACY CONTACT EMAIL]",
  copyrightName: "OCCASIONFUN LTD",
  /** Update annually at the start of each calendar year. */
  copyrightYear: 2026,
} as const;

export type CompanyConfig = typeof company;

export const positioning = {
  tagline:
    "Practical technology services for organisations that need dependable delivery.",
  supportingMessage:
    "OccasionFun Ltd is a UK-registered company that identifies technology project opportunities, takes part in bidding and proposals, and coordinates delivery. Technical work is carried out by DGV Group, a separate India-registered company under common ownership.",
  homepageHeadline:
    "IT services and technology projects, coordinated from the UK.",
  homepageSubheading:
    "OccasionFun Ltd identifies project opportunities, leads bidding and business engagement, and coordinates delivery. The technical work is carried out by DGV Group, a separate India-registered company under common ownership.",
} as const;

export const enquiryTypes = [
  "Public-sector procurement",
  "Prime contractor/subcontracting",
  "Cloud/DevOps",
  "Software development",
  "AI solutions",
  "QA automation",
  "Web/WordPress",
  "Data engineering",
  "Managed IT",
  "Other",
] as const;

export type EnquiryType = (typeof enquiryTypes)[number];

/** Returns true if a string still contains an unresolved placeholder. */
export function isUnresolvedPlaceholder(value: string): boolean {
  return value.includes(PLACEHOLDER_PREFIX);
}

/** Lists company fields that still need verified values before launch. */
export function getUnresolvedPlaceholders(): Array<{
  key: string;
  value: string;
}> {
  const entries: Array<{ key: string; value: string }> = [
    { key: "registeredOffice", value: company.registeredOffice },
    { key: "businessEmail", value: company.businessEmail },
    { key: "businessPhone", value: company.businessPhone },
    { key: "domain", value: company.domain },
    { key: "ukRepresentativeName", value: company.ukRepresentativeName },
    { key: "ukRepresentativeRole", value: company.ukRepresentativeRole },
    { key: "dgvLegalName", value: company.dgvLegalName },
    { key: "dgvCountry", value: company.dgvCountry },
    { key: "dgvRegisteredAddress", value: company.dgvRegisteredAddress },
    { key: "dgvWebsite", value: company.dgvWebsite },
    { key: "privacyEmail", value: company.privacyEmail },
  ];

  return entries.filter((entry) => isUnresolvedPlaceholder(entry.value));
}

/**
 * Display helper: show a readable placeholder label in the UI without
 * looking like a real address or contact detail.
 */
export function displayOrPending(value: string, pendingLabel: string): string {
  return isUnresolvedPlaceholder(value) ? pendingLabel : value;
}
