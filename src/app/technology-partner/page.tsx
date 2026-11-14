import Link from "next/link";
import { CTABanner } from "@/components/ui/CTABanner";
import { DeliveryModelDiagram } from "@/components/ui/DeliveryModelDiagram";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { company } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "OccasionFun and DGV Group",
  description:
    "OccasionFun Ltd and DGV Group are separate companies under common ownership. OccasionFun coordinates projects. DGV Group provides the technical delivery.",
  path: "/technology-partner",
});

const occasionFunRole = [
  "Identifying project opportunities",
  "Bidding and proposals",
  "Business engagement with the client or buyer",
  "Project coordination through to handover",
];

const dgvRole = [
  "Technical planning and architecture",
  "Design and development",
  "Testing",
  "Implementation and related technical work",
];

export default function TechnologyPartnerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Technology partner"
        title="Two companies. OccasionFun coordinates, and DGV Group builds."
        description={`${company.legalName} and DGV Group are separate legal entities under common ownership. OccasionFun is the UK company a client deals with. DGV Group is the India-registered company that carries out the technical work.`}
      />

      <Section title="Who does what">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              United Kingdom
            </p>
            <h3 className="mt-3 text-2xl text-navy-900">OccasionFun Ltd</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Company number {company.companyNumber}. OccasionFun identifies
              opportunities, takes part in bids and manages the business
              relationship and project coordination.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {occasionFunRole.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              India
            </p>
            <h3 className="mt-3 text-2xl text-navy-900">DGV Group</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A separate India-registered company under the same ownership. DGV
              Group is the dedicated technical delivery company for agreed
              work.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {dgvRole.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </Section>

      <Section
        tone="muted"
        title="How the relationship supports a project"
        description="A buyer deals with OccasionFun. When work is agreed, DGV Group carries out the technical delivery and OccasionFun coordinates it. The diagram is a summary of that relationship, not the full lifecycle."
      >
        <DeliveryModelDiagram />
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-slate-600">
          The stages are explained on{" "}
          <Link
            href="/how-we-work"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            How we work
          </Link>
          . Not every project uses the same stages or the same contract. Where
          a buyer needs the delivery location, system access or DGV Group’s
          role explained, that is set out for the requirement. Access from
          outside the UK is not assumed to be acceptable.
        </p>
      </Section>

      <Section title="What this page states, and what it does not">
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            ["Name used here", "DGV Group"],
            ["Where it is registered", "India"],
            [
              "Relationship",
              "Separate legal entity under common ownership with OccasionFun Ltd",
            ],
            [
              "Not published here",
              "DGV Group’s full legal name, company number, registered address and website",
            ],
          ].map(([label, value]) => (
            <div key={label} className="border-t border-slate-200 pt-4">
              <dt className="text-sm font-semibold text-navy-900">{label}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-slate-600">
          This page does not describe either company as a subsidiary, parent or
          joint venture of the other. Read{" "}
          <Link
            href="/about"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            About OccasionFun
          </Link>{" "}
          or the{" "}
          <Link
            href="/public-sector"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            public-sector overview
          </Link>
          .
        </p>
      </Section>

      <CTABanner
        title="Questions about how a project would be staffed?"
        description="OccasionFun can explain how coordination and technical delivery would be split for a specific opportunity."
        primaryHref="/contact"
        primaryLabel="Discuss a project"
        secondaryHref="/how-we-work"
        secondaryLabel="See how we work"
      />
    </>
  );
}
