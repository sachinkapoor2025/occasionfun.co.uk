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
  /** Confirmed business address. Not a verified registered office. */
  businessAddress: "5 Exeter Road, Southampton, England, SO18 2ED",
  /**
   * Left unresolved on purpose. Organisation JSON-LD publishes this as the
   * organisation email once it is a real address. It is not the SMTP sender
   * and not the registration/bidding address.
   */
  businessEmail: "[INSERT VERIFIED BUSINESS EMAIL]",
  /** Registration and bidding correspondence only. Not a contact-form destination. */
  biddingEmail: "bids@occasionfun.co.uk",
  businessPhone: "+44-7710647388",
  /** Compact tel target for the displayed business number. */
  businessPhoneTel: "tel:+447710647388",
  domain: "[INSERT VERIFIED WEBSITE DOMAIN]",
  /**
   * Public SEO origin. Always the apex site. Do not replace this with a www
   * host or an Amplify preview URL.
   */
  siteUrl: "https://occasionfun.co.uk",
  ukRepresentativeName: "Prashant Rai",
  ukRepresentativeRole: "Head of Technology & Client Delivery",
  /**
   * Short name interpolated by the privacy notice. Leave as DGV so that
   * legal page stays unchanged in this phase.
   */
  dgvDisplayName: "DGV",
  dgvPartnerName: "Divit Global Ventures",
  dgvPartnerAddress:
    "H No. 392, Mohalla Sodian Wala, Ferozepur City, Punjab, India",
  dgvPartnerEmail: "dgv@mydgv.com",
  dgvGst: "03EOOPR9563D1ZH",
  dgvPartnerContact: "Mamta Rani",
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

export const partnershipSummary =
  "OccasionFun Ltd is a UK technology services company that engages with clients, understands their requirements and coordinates technology projects. Working with its technology delivery partner, Divit Global Ventures (DGV), it supports the design, development and delivery of IT solutions and digital platforms for clients.";

export const partnershipShort =
  "OccasionFun works with Divit Global Ventures (DGV), its technology delivery partner, to design, develop and deliver digital platforms and software solutions.";

export const positioning = {
  tagline:
    "Practical technology services for organisations that need dependable delivery.",
  supportingMessage: partnershipSummary,
  homepageHeadline:
    "IT services and technology projects, coordinated from the UK.",
  homepageSubheading: partnershipSummary,
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
    { key: "domain", value: company.domain },
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
