export type PolicyDocument = {
  id: string;
  title: string;
  description: string;
  status: "published" | "available-on-request" | "not-yet-available";
  href?: string;
};

/**
 * Only documents genuinely approved for publication should use status "published".
 * Do not auto-generate legal PDFs or present drafts as reviewed.
 */
export const policyDocuments: PolicyDocument[] = [
  {
    id: "privacy-notice",
    title: "Privacy notice",
    description:
      "Draft website privacy notice. Requires legal review before it is treated as final.",
    status: "published",
    href: "/privacy",
  },
  {
    id: "cookie-notice",
    title: "Cookie notice",
    description:
      "Draft cookie notice describing essential and optional cookies. Requires legal review.",
    status: "published",
    href: "/cookies",
  },
  {
    id: "terms",
    title: "Website terms of use",
    description:
      "Draft website terms. Requires legal review before launch reliance.",
    status: "published",
    href: "/terms",
  },
  {
    id: "information-security-policy",
    title: "Information security policy (external version)",
    description:
      "Approved external version only. Not yet available for public download.",
    status: "not-yet-available",
  },
  {
    id: "data-protection-policy",
    title: "Data protection / privacy policy (external version)",
    description:
      "Approved external version only. Available on request once approved.",
    status: "available-on-request",
  },
  {
    id: "business-continuity",
    title: "Business continuity policy",
    description:
      "Publish only if created and tested as appropriate for the company's operating model.",
    status: "not-yet-available",
  },
  {
    id: "modern-slavery",
    title: "Modern slavery statement",
    description:
      "Only if applicable and approved. Not currently published.",
    status: "not-yet-available",
  },
  {
    id: "environmental",
    title: "Environmental or sustainability policy",
    description: "Publish only if created and approved.",
    status: "not-yet-available",
  },
  {
    id: "quality-policy",
    title: "Quality policy",
    description: "Publish only if created and approved.",
    status: "not-yet-available",
  },
  {
    id: "health-safety",
    title: "Health and safety policy",
    description: "Publish only if applicable and approved.",
    status: "not-yet-available",
  },
  {
    id: "supplier-overview",
    title: "Supplier overview / capability statement",
    description:
      "Procurement-facing overview. Available on request once approved for release.",
    status: "available-on-request",
  },
  {
    id: "insurance",
    title: "Insurance certificates",
    description:
      "Shared privately where appropriate. Sensitive policy numbers are not published on this website.",
    status: "available-on-request",
  },
];
