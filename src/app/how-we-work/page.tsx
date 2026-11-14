import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "How we work",
  description:
    "A project can move through opportunity, evaluation, planning, technical delivery, testing and handover. Not every engagement uses every stage.",
  path: "/how-we-work",
});

const steps = [
  {
    title: "Opportunity identification",
    who: "OccasionFun",
    text: "OccasionFun looks for a technology opportunity that fits the work the companies can coordinate and deliver.",
  },
  {
    title: "Requirement evaluation",
    who: "OccasionFun, with technical input where needed",
    text: "The requirement, constraints and fit are assessed before a commitment. DGV Group can advise on the technical fit.",
  },
  {
    title: "Proposal and planning",
    who: "OccasionFun leads",
    text: "OccasionFun prepares the proposal and the coordination plan. DGV Group contributes the technical approach for the work being proposed.",
  },
  {
    title: "Technical architecture and design",
    who: "DGV Group",
    text: "DGV Group plans the architecture and design for the agreed scope.",
  },
  {
    title: "Development and implementation",
    who: "DGV Group",
    text: "DGV Group builds and implements the solution. OccasionFun coordinates communication with the client.",
  },
  {
    title: "Testing and quality assurance",
    who: "DGV Group",
    text: "The work is tested against the requirements agreed for that project.",
  },
  {
    title: "Deployment and handover",
    who: "Both companies",
    text: "DGV Group carries out the technical deployment. OccasionFun coordinates acceptance, documentation and handover.",
  },
  {
    title: "Ongoing support where agreed",
    who: "Only when it is part of the engagement",
    text: "Support continues only if it was agreed. Who provides it is set out for that engagement, not assumed for every project.",
  },
];

export default function HowWeWorkPage() {
  return (
    <>
      <PageHeader
        eyebrow="How we work"
        title="From an opportunity to technical delivery and handover"
        description="A project can move through the stages below. It does not have to use every stage, and the agreement is for that piece of work."
      />

      <Section title="Project stages">
        <p className="mb-8 max-w-3xl text-sm leading-relaxed text-slate-600">
          The relationship between the companies is explained on the{" "}
          <Link
            href="/technology-partner"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            technology partner
          </Link>{" "}
          page.
        </p>
        <ol className="space-y-6">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[88px_1fr] sm:p-6"
            >
              <div
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-900 text-lg font-semibold text-white"
              >
                {index + 1}
              </div>
              <div>
                <h3 className="text-xl text-navy-900">
                  <span className="sr-only">Stage {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  {step.who}
                </p>
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
        title="What is agreed for the engagement"
        description="These points are settled for the work in front of us. They are not a single contract used for every client."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            "The scope, assumptions and acceptance criteria",
            "Who at OccasionFun coordinates, and what DGV Group will deliver",
            "Security, data handling and access constraints",
            "Delivery location, where the buyer needs it stated",
            "How change will be handled",
            "Whether any support continues after handover",
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

      <section className="bg-role-primary pb-10 sm:pb-12">
        <Container>
          <div className="rounded-2xl bg-role-emphasis px-6 py-10 sm:px-10 sm:py-12">
            <h2 className="text-3xl text-white sm:text-4xl">Discuss a project</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-200">
              Tell OccasionFun what the opportunity needs to achieve.
            </p>
            <div className="mt-8">
              <ButtonLink href="/contact">Discuss a project</ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
