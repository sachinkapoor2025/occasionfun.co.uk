import { PageHeader } from "@/components/ui/PageHeader";
import { ReviewWarning } from "@/components/ui/ReviewWarning";
import { Section } from "@/components/ui/Section";
import { company } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Website terms of use",
  description:
    "Draft website terms for OCCASIONFUN LTD. Governing-law and liability clauses require legal review before launch reliance.",
  path: "/terms",
  indexable: false,
});

export default function TermsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Website terms of use"
        description="Draft placeholder terms for use of this website. Do not invent governing-law, liability caps or warranty language until legally reviewed."
      />

      <Section>
        <ReviewWarning />
        <div className="max-w-3xl space-y-6 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-xl text-navy-900">About these terms</h2>
            <p className="mt-3">
              This website provides general information about {company.legalName}
              and its technology services. Website content is not a contractual
              offer and does not replace statements of work, tender responses or
              signed agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Accuracy</h2>
            <p className="mt-3">
              We aim to keep information accurate and current, but website
              content may contain placeholders pending verification. Company
              identity details such as legal name and company number are intended
              to match official records once launch checks are complete.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Acceptable use</h2>
            <p className="mt-3">
              You must not misuse this website, attempt unauthorised access, or
              submit unlawful, harmful or deceptive content through the contact
              form.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Intellectual property</h2>
            <p className="mt-3">
              Site content, branding and original materials are owned by
              {` ${company.legalName} `}
              or used under licence. No government, NHS, Crown or third-party
              marks are used without permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Legal review pending</h2>
            <p className="mt-3">
              Governing law, jurisdiction, limitation of liability and other
              operative clauses are intentionally omitted from this draft until
              legal counsel provides approved wording.
            </p>
          </section>
        </div>
      </Section>
    </>
  );
}
