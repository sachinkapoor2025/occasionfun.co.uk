import { CTABanner } from "@/components/ui/CTABanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { company } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Policy",
  description:
    "Company policies published by OCCASIONFUN LTD for clients, prime contractors and public-sector buyers, covering environmental sustainability and equality, diversity and inclusion.",
  path: "/policies",
  indexable: true,
});

const environmentalConsiderations = [
  "Thoughtful use of digital tools and cloud resources, including sizing, monitoring and shutting down unused development or test resources where appropriate",
  "Remote meetings where practical, and consideration of business travel before it is arranged",
  "Electronic records, and less unnecessary printing and material use",
  "Reuse, repair or recycling where the company controls disposal of IT equipment",
  "Proportionate attention to the environmental and social practices of suppliers and subcontractors",
  "Accessibility, maintainability and efficient use of technology when designing and delivering services",
];

const equalityPractices = [
  "Recruitment and selection against criteria that are relevant to the role",
  "Training and development based on business needs, role requirements and fair criteria",
  "Promotion and progression communicated and assessed against objective criteria",
  "Discipline and dismissal handled consistently, fairly and in line with applicable procedures",
  "Terms, benefits and allocation of work decided without unlawful discrimination",
  "Reasonable adjustments for disabled applicants and workers where the law requires them",
];

export default function PoliciesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Policy"
        title="Policy"
        description={`${company.legalName} publishes these company policies for clients, prime contractors and public-sector buyers. They explain how the company approaches environmental sustainability and equality, diversity and inclusion.`}
      />

      <Section
        title="Environmental Sustainability Policy"
        description="OCCASIONFUN LTD is committed to managing the environmental and social impacts of its business. Sustainability is considered when planning and delivering technology services, procuring goods and services, selecting delivery partners and managing day-to-day operations."
      >
        <a
          href="/policies/OCCASIONFUN_Environmental_Sustainability_Policy.pdf"
          download="OCCASIONFUN_Environmental_Sustainability_Policy.pdf"
          aria-label="Download Environmental Sustainability Policy PDF"
          className="mb-8 inline-flex max-w-full items-center justify-center gap-2 rounded-md bg-navy-900 px-5 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_10px_24px_-14px_rgba(11,31,51,0.65)] transition-colors duration-200 hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Download PDF
        </a>
        <ul className="grid gap-3 sm:grid-cols-2">
          {environmentalConsiderations.map((item) => (
            <li
              key={item}
              className="border-l-2 border-accent/40 pl-4 text-sm text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8 max-w-3xl space-y-4 text-sm leading-relaxed text-slate-600">
          <p>
            The policy applies to the company&apos;s directors, employees,
            contractors and anyone acting on its behalf. It covers UK business
            operations and, where relevant and contractually applicable,
            technical delivery by subcontractors and delivery partners. The
            company seeks practical improvements, monitors progress and reviews
            the policy at least annually.
          </p>
          <p>
            The company will work towards understanding its greenhouse gas
            emissions. It does not claim third-party verification, science-based
            targets or carbon footprints for its products or services unless
            those have been independently evidenced.
          </p>
          <p>
            Policy lead: Prashant Rai, UK Business Head. Effective 15 March
            2026.
          </p>
        </div>
      </Section>

      <Section
        tone="muted"
        title="Equality, Diversity and Inclusion Policy"
        description="OCCASIONFUN LTD is committed to equal opportunities and to treating people fairly and with dignity. Discrimination, harassment, bullying and victimisation are not tolerated. Decisions about employment, engagement, training, progression and the delivery of services are based on relevant, fair and objective criteria."
      >
        <a
          href="/policies/OCCASIONFUN_Equality_Diversity_and_Inclusion_Policy.pdf"
          download="OCCASIONFUN_Equality_Diversity_and_Inclusion_Policy.pdf"
          aria-label="Download Equality, Diversity and Inclusion Policy PDF"
          className="mb-8 inline-flex max-w-full items-center justify-center gap-2 rounded-md bg-navy-900 px-5 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_10px_24px_-14px_rgba(11,31,51,0.65)] transition-colors duration-200 hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Download PDF
        </a>
        <ul className="grid gap-3 sm:grid-cols-2">
          {equalityPractices.map((item) => (
            <li
              key={item}
              className="border-l-2 border-accent/40 pl-4 text-sm text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8 max-w-3xl space-y-4 text-sm leading-relaxed text-slate-600">
          <p>
            The policy applies to directors, employees, workers, contractors,
            agency workers, consultants and anyone acting on the company&apos;s
            behalf. It also sets the standards expected when working with
            clients, suppliers, subcontractors and delivery partners. It does
            not replace a delivery partner&apos;s own legal obligations.
          </p>
          <p>
            For activities in Great Britain, the company has regard to the
            Equality Act 2010. Where people are engaged or employed in another
            country, the company seeks to meet the legal requirements that
            apply there and to maintain fair and respectful treatment.
          </p>
          <p>
            A concern can be raised with Prashant Rai, UK Business Head, or
            with another director if the concern involves the policy owner. The
            company does not tolerate retaliation against anyone who raises a
            concern in good faith. The policy is reviewed at least annually.
          </p>
          <p>
            Policy lead: Prashant Rai, UK Business Head. Effective 15 March
            2026.
          </p>
        </div>
      </Section>

      <CTABanner
        title="Procurement enquiries"
        description="Contact OCCASIONFUN LTD about these policies, or about a public-sector or prime-contractor requirement."
        primaryHref="/contact?enquiryType=Public-sector%20procurement"
        primaryLabel="Contact OCCASIONFUN LTD"
        secondaryHref="/public-sector"
        secondaryLabel="Public sector"
      />
    </>
  );
}
