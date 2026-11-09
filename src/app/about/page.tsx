import { CTABanner } from "@/components/ui/CTABanner";
import { DeliveryModelDiagram } from "@/components/ui/DeliveryModelDiagram";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { company, positioning } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "About us",
  description:
    "Learn how OCCASIONFUN LTD operates as a UK-registered technology services company, with specialist delivery support from technology partner DGV where appropriate.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About us"
        title={`${company.legalName} exists to deliver practical technology services with clear accountability.`}
        description={positioning.supportingMessage}
      />

      <Section
        title="Purpose and operating model"
        description="We help organisations plan, build, improve and support digital services. Our approach emphasises clear communication, delivery transparency and proportionate governance matched to client requirements."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <article className="border-t border-slate-200 pt-5">
            <h3 className="text-xl text-navy-900">UK registration and engagement</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {company.legalName} is registered in the {company.jurisdiction}
              (company number {company.companyNumber}). Business engagement is
              coordinated through a UK-facing operating setup, including UK
              business representation and UK-based IT professional capacity as
              part of the current model. Named personal details are published
              only after company approval.
            </p>
          </article>
          <article className="border-t border-slate-200 pt-5">
            <h3 className="text-xl text-navy-900">Capability-led delivery</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We describe what we can deliver, how we organise work, and how
              responsibilities are agreed. We do not invent trading history,
              client portfolios or certifications. Where specialist engineering
              capacity is needed, we may use technology partner{" "}
              {company.dgvDisplayName} under transparent subcontracting
              arrangements.
            </p>
          </article>
        </div>
      </Section>

      <Section
        tone="muted"
        title="Our delivery model"
        description="A simple view of how engagement, coordination, engineering delivery and handover fit together."
      >
        <DeliveryModelDiagram />
      </Section>

      <Section
        title="Technology partner: DGV"
        description={`${company.dgvDisplayName} supports specialist engineering and technical delivery where appropriate to a project. ${company.legalName} remains the supplier-facing company responsible for client engagement and contractual coordination.`}
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            "Delivery resources and locations are agreed for each engagement",
            "Subcontracting is disclosed according to tender and contract rules",
            "Overseas access is never assumed to be acceptable by default",
            "Security and data-protection safeguards are scoped to the engagement",
          ].map((item) => (
            <li
              key={item}
              className="border-l-2 border-accent/50 pl-4 text-sm leading-relaxed text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <CTABanner
        title="Talk to us about a requirement"
        description="Whether you need a capability conversation or a procurement-facing overview, we are ready to engage clearly and carefully."
      />
    </>
  );
}
