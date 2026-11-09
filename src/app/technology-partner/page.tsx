import { CTABanner } from "@/components/ui/CTABanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { company, displayOrPending } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Technology partner — DGV",
  description:
    "How OCCASIONFUN LTD works with DGV as a technology and engineering delivery partner, with transparent subcontracting and client-approval commitments.",
  path: "/technology-partner",
});

export default function TechnologyPartnerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Technology partner"
        title={`${company.dgvDisplayName} is our technology and engineering delivery partner`}
        description={`${company.legalName} remains the contracting-facing company. ${company.dgvDisplayName} provides specialist engineering and technical delivery support where appropriate to a particular engagement and subject to client requirements.`}
      />

      <Section title="How the partnership works">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Client engagement",
              text: `${company.legalName} manages client engagement, commercial coordination and delivery accountability as the supplier-facing company.`,
            },
            {
              title: "Specialist delivery",
              text: `${company.dgvDisplayName} may contribute engineering capacity for agreed work packages, under subcontracting arrangements disclosed as required.`,
            },
            {
              title: "Project-specific roles",
              text: "Responsibilities, delivery locations and access rights are allocated for each engagement—not assumed as a fixed default for every buyer.",
            },
          ].map((item) => (
            <article key={item.title} className="border-t border-slate-200 pt-5">
              <h3 className="text-xl text-navy-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        tone="muted"
        title="Transparency commitments"
        description="We describe the relationship carefully and avoid legal terms that have not been verified."
      >
        <ul className="space-y-3">
          {[
            `${company.dgvDisplayName} is described as a technology partner or delivery partner unless a more precise approved legal term is confirmed.`,
            "We do not describe DGV as a UK subsidiary, group company, parent, joint venture or affiliate unless the legal relationship supports that description.",
            "Where a contract requires client approval before subcontracting or overseas access, we obtain that approval before proceeding.",
            "Data-protection and security safeguards are scoped to the engagement and agreed contractually.",
          ].map((item) => (
            <li
              key={item}
              className="border-l-2 border-accent/40 pl-4 text-sm leading-relaxed text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="DGV identity details pending verification">
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          The following fields remain placeholders until the company confirms
          verified legal identity and approved brand materials.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["Display name", company.dgvDisplayName],
            [
              "Full legal name",
              displayOrPending(
                company.dgvLegalName,
                "Pending verified legal name",
              ),
            ],
            [
              "Country of registration",
              displayOrPending(
                company.dgvCountry,
                "Pending verified country",
              ),
            ],
            [
              "Registered address",
              displayOrPending(
                company.dgvRegisteredAddress,
                "Pending verified address",
              ),
            ],
            [
              "Website",
              displayOrPending(
                company.dgvWebsite,
                "Pending approved website (if any)",
              ),
            ],
            [
              "Named points of contact",
              "Not published until approved",
            ],
          ].map(([label, value]) => (
            <div key={label} className="border-t border-slate-200 pt-4">
              <dt className="text-sm font-semibold text-navy-900">{label}</dt>
              <dd className="mt-1 text-sm text-slate-600">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <CTABanner
        title="Questions about the delivery model?"
        description="We are happy to explain how responsibilities would be structured for a specific engagement."
        secondaryHref="/public-sector"
        secondaryLabel="Public-sector overview"
      />
    </>
  );
}
