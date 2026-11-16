import { CTABanner } from "@/components/ui/CTABanner";
import { DocumentList } from "@/components/ui/DocumentList";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReviewWarning } from "@/components/ui/ReviewWarning";
import { Section } from "@/components/ui/Section";
import { policyDocuments } from "@/content/policies";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Policies and supplier documents",
  description:
    "Draft document library for OCCASIONFUN LTD. The website notices are in preparation and are not approved for use.",
  path: "/policies",
  indexable: false,
});

export default function PoliciesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Policies"
        title="Policies and supplier documents"
        description="The privacy, cookie and terms notices linked here are drafts in preparation. They are not approved for use. Other documents are on request or not yet available."
      />

      <Section>
        <ReviewWarning>
          The privacy, cookie and terms notices are drafts in preparation. They
          require legal review and company approval before they are relied on.
          Do not treat these pages as final policy instruments.
        </ReviewWarning>
        <DocumentList documents={policyDocuments} />
      </Section>

      <CTABanner
        title="Need a document that is available on request?"
        description="Use the contact form to request supplier information. Sensitive materials are shared through controlled channels."
        primaryHref="/contact?enquiryType=Public-sector%20procurement"
        primaryLabel="Request supplier information"
      />
    </>
  );
}
