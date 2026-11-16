import type { Metadata } from "next";
import { company, partnershipSummary } from "@/config/company";

const defaultDescription = partnershipSummary;

export function createPageMetadata({
  title,
  description = defaultDescription,
  path = "/",
  indexable = true,
  image,
}: {
  title: string;
  description?: string;
  path?: string;
  /** Draft legal pages stay public but are omitted from search indexes. */
  indexable?: boolean;
  /** Path under the site, such as a case-study preview. No external URLs. */
  image?: string;
}): Metadata {
  const canonicalPath = path === "/" ? "/" : `${path.replace(/\/$/, "")}/`;
  const url = new URL(canonicalPath, company.siteUrl).toString();
  const fullTitle =
    title === company.legalName
      ? `${company.legalName} | Technology services`
      : `${title} | ${company.legalName}`;
  const images = image ? [image] : undefined;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: company.legalName,
      locale: "en_GB",
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images,
    },
    robots: {
      index: indexable,
      follow: indexable,
    },
  };
}
