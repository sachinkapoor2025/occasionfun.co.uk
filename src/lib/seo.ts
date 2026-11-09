import type { Metadata } from "next";
import { company } from "@/config/company";

const defaultDescription =
  "OCCASIONFUN LTD is a UK-registered technology services company offering software, cloud, data, quality engineering and digital solutions, with specialist delivery support through technology partner DGV where appropriate.";

export function createPageMetadata({
  title,
  description = defaultDescription,
  path = "/",
}: {
  title: string;
  description?: string;
  path?: string;
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
      index: true,
      follow: true,
    },
  };
}
