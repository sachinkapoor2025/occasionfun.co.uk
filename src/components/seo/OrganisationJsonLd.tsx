import { company } from "@/config/company";
import { isUnresolvedPlaceholder } from "@/config/company";

/**
 * Structured data limited to verified fields only.
 * Address, telephone and social profiles are omitted until verified.
 */
export function OrganisationJsonLd() {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.legalName,
    legalName: company.legalName,
    url: company.siteUrl,
    identifier: company.companyNumber,
    areaServed: "GB",
  };

  if (!isUnresolvedPlaceholder(company.businessEmail)) {
    data.email = company.businessEmail;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
