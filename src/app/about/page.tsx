import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { company, partnershipSummary } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "About us",
  description:
    "OccasionFun Ltd is a UK technology services company. It engages clients, gathers requirements and coordinates technology projects with Divit Global Ventures (DGV).",
  path: "/about",
});

const responsibilities = [
  {
    title: "Client engagement",
    text: "OccasionFun engages UK businesses, public-sector buyers and prime contractors, and keeps the client conversation.",
  },
  {
    title: "Requirements and bidding",
    text: "OccasionFun gathers requirements, assesses fit and prepares the bid or proposal.",
  },
  {
    title: "Project coordination",
    text: "OccasionFun coordinates scope, communication and handover, and supports delivery of the technology project.",
  },
  {
    title: "The UK company",
    text: `Clients deal with OccasionFun Ltd, company number ${company.companyNumber}, for the relationship and the project conversation.`,
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About us"
        title="A UK technology services company."
        description={`${partnershipSummary} ${company.legalName} is registered in the ${company.jurisdiction}, company number ${company.companyNumber}.`}
      />

      <Section
        title="What OccasionFun is responsible for"
        description="These are the commercial responsibilities. The kinds of technical work are described on the services pages."
      >
        <ul className="grid gap-6 sm:grid-cols-2">
          {responsibilities.map((item) => (
            <li key={item.title} className="border-t border-slate-200 pt-5">
              <h3 className="text-xl text-navy-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {item.text}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-slate-600">
          <Link
            href="/services"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Services
          </Link>{" "}
          lists the technical work that can be scoped.{" "}
          <Link
            href="/public-sector"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Public sector
          </Link>{" "}
          explains procurement positioning.{" "}
          <Link
            href="/how-we-work"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            How we work
          </Link>{" "}
          explains how a project can proceed.
        </p>
      </Section>

      <Section
        tone="muted"
        title="Technical delivery"
        description="DGV is OccasionFun's technology delivery partner. DGV provides IT services, software development, application engineering and technical project delivery for clients."
      >
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          <Link
            href="/technology-partner"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Technology Partner — DGV
          </Link>
        </p>
      </Section>

      <section className="bg-role-primary pb-10 sm:pb-12">
        <Container>
          <div className="rounded-2xl bg-role-emphasis px-6 py-10 sm:px-10 sm:py-12">
            <h2 className="text-3xl text-white sm:text-4xl">Discuss a project</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-200">
              Share the opportunity or the requirement. OccasionFun will
              coordinate the conversation.
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
