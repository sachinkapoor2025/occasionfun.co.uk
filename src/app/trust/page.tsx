import { CTABanner } from "@/components/ui/CTABanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { company } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Quality, security and data protection",
  description:
    "OCCASIONFUN LTD approach to quality, information security and data protection—described as delivery practices, not unverified certifications.",
  path: "/trust",
});

export default function TrustPage() {
  return (
    <>
      <PageHeader
        eyebrow="Trust"
        title="Quality, security and data protection"
        description="This page describes our delivery approach. It does not claim certified management systems, Cyber Essentials, ISO accreditation or government approval unless independently verified and authorised."
      />

      <Section
        title="Quality"
        description="Practices we aim to follow and evidence on engagements. Labelled as our delivery approach rather than a certified quality-management system."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            "Requirements traceability where appropriate",
            "Peer review and testing appropriate to the project",
            "Defect tracking and release checks",
            "Documentation and handover",
            "Continuous improvement based on delivery feedback",
          ].map((item) => (
            <li
              key={item}
              className="border-l-2 border-accent/40 pl-4 text-sm text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        tone="muted"
        title="Information security"
        description="Security controls are agreed and evidenced for each project. The items below are design objectives and engagement practices—not a claim that every control is already implemented company-wide."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            "Least-privilege access as a design objective",
            "MFA where supported and required",
            "Secure credential handling",
            "Environment separation where appropriate",
            "Logging and access review appropriate to the engagement",
            "Secure development and dependency management",
            "Incident escalation and client notification according to contract",
          ].map((item) => (
            <li
              key={item}
              className="border-l-2 border-accent/40 pl-4 text-sm text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Cyber Essentials">
        <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-slate-600">
          <p>
            {company.legalName} does not display a Cyber Essentials badge and
            does not claim Cyber Essentials or Cyber Essentials Plus
            certification at this stage. The company has chosen not to pursue
            Cyber Essentials at initial website launch.
          </p>
          <p>
            Some procurements may require Cyber Essentials, Cyber Essentials
            Plus or equivalent controls. The company must assess each tender&apos;s
            exact requirements and only bid where it can meet them. We do not
            suggest that all tenders can be bid without such controls.
          </p>
        </div>
      </Section>

      <Section
        tone="muted"
        title="Data protection"
        description="Personal data is handled only where necessary and under documented roles and instructions."
      >
        <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-slate-600">
          <p>
            Where {company.dgvDisplayName} or another overseas partner may access
            personal data from outside the UK, the parties must assess whether
            this constitutes a restricted international transfer and implement
            the applicable UK GDPR transfer mechanism and risk assessment where
            required.
          </p>
          <p>
            We do not claim that an IDTA, UK Addendum, Transfer Risk Assessment,
            DPA or other legal document is already signed unless confirmed. Data
            locations, access, retention, deletion and subprocessors are agreed
            contractually for each engagement.
          </p>
        </div>
      </Section>

      <Section>
        <aside
          role="note"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-600"
        >
          <strong className="font-semibold text-navy-900">Disclaimer: </strong>
          Website content is general information and does not replace
          contract-specific security or legal documentation. Buyers should rely
          on tender responses, statements of work and executed agreements for
          binding commitments.
        </aside>
      </Section>

      <CTABanner
        title="Need supplier assurance information?"
        description="Request available policies or discuss security and data-protection requirements for a specific engagement."
        primaryHref="/contact?enquiryType=Public-sector%20procurement"
        primaryLabel="Request information"
        secondaryHref="/policies"
        secondaryLabel="Policy library"
      />
    </>
  );
}
