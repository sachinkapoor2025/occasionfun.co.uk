import type { Metadata } from "next";
import { company } from "@/config/company";

const defaultDescription =
  "OccasionFun Ltd is a UK-registered company that identifies technology project opportunities, leads bidding and coordinates delivery. Technical work is carried out by DGV Group, a separate India-registered company under common ownership.";

export function createPageMetadata({
  title,
  description = defaultDescription,
  path = "/",
  indexable = true,
}: {
  title: string;
  description?: string;
  path?: string;
  /** Draft legal pages stay public but are omitted from search indexes. */
  indexable?: boolean;
}): Metadata {
  const url = new URL(path, company.siteUrl).toString();
  const fullTitle =
    title === company.legalName
      ? `${company.legalName} | Technology services`
      : `${title} | ${company.legalName}`;

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
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
    robots: {
      index: indexable,
      follow: indexable,
    },
  };
}
