import { CTABanner } from "@/components/ui/CTABanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "How we work",
  description:
    "OCCASIONFUN LTD delivery lifecycle from discovery and scoping through security review, build, acceptance, handover and support.",
  path: "/how-we-work",
});

const steps = [
  {
    title: "Discovery and requirement clarification",
    text: "We clarify objectives, constraints, stakeholders, success measures and any known compliance or security requirements.",
  },
  {
    title: "Scope, deliverables, assumptions and acceptance criteria",
    text: "Scope is written down with explicit assumptions, exclusions and acceptance criteria so delivery can be measured fairly.",
  },
  {
    title: "Delivery plan, roles and named responsibilities",
    text: "We agree who owns account coordination, technical delivery, reviews and client decision points for the engagement.",
  },
  {
    title: "Security, data protection and subcontractor review",
    text: "Access, data handling, delivery locations and any subcontracting arrangements are reviewed against contract and buyer requirements before work proceeds.",
  },
  {
    title: "Build/configuration and quality assurance",
    text: "Delivery proceeds against the agreed plan with testing, peer review and defect tracking appropriate to the project.",
  },
  {
    title: "Demonstration, testing and client acceptance",
    text: "Outcomes are demonstrated and tested against acceptance criteria. Issues are tracked to resolution or explicitly deferred by agreement.",
  },
  {
    title: "Handover, documentation and support",
    text: "Documentation, credentials transfer (where applicable), and any ongoing support arrangements are completed as defined in the contract.",
  },
];

export default function HowWeWorkPage() {
  return (
    <>
      <PageHeader
        eyebrow="How we work"
        title="A practical lifecycle for accountable delivery"
        description="Project governance, reporting frequency, service levels and change control are agreed in the statement of work or contract—not left as informal assumptions."
      />

      <Section>
        <ol className="space-y-6">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[88px_1fr] sm:p-6"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-900 text-lg font-semibold text-white">
                {index + 1}
              </div>
              <div>
                <h2 className="text-xl text-navy-900">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        tone="muted"
        title="What we agree up front"
        description="Clear commercial and delivery boundaries reduce ambiguity later."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            "Statement of work or equivalent scope document",
            "Named responsibilities and communication rhythm",
            "Security and data-handling constraints",
            "Subcontractor and location disclosures where required",
            "Acceptance criteria and change-control approach",
            "Support expectations after handover, if any",
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

      <CTABanner
        title="Ready to outline a requirement?"
        description="Share what you need to achieve. We will help structure discovery and next steps."
      />
    </>
  );
}
