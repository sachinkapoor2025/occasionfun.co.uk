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
    "Document library for OCCASIONFUN LTD policies and supplier documents. Only approved materials are published; others are available on request or pending.",
  path: "/policies",
  indexable: false,
});

export default function PoliciesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Policies"
        title="Policies and supplier documents"
        description="This library shows documents that are approved for publication, available on request, or not yet available. We do not auto-generate legal policies and present them as legally reviewed."
      />

      <Section>
        <ReviewWarning>
          Pre-launch checklist: every policy marked published must be legally
          reviewed and company-approved before public launch reliance. Do not
          treat draft website pages as final policy instruments.
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
