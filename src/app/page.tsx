import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { CTABanner } from "@/components/ui/CTABanner";
import { Section } from "@/components/ui/Section";
import { ServiceCatalogue } from "@/components/ui/ServiceCatalogue";
import { company } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: company.legalName,
  description:
    "OccasionFun Ltd is a UK-registered IT services company. It identifies technology project opportunities, leads bidding and business engagement, and coordinates delivery with DGV Group.",
  path: "/",
});

const whatWeDo = [
  {
    title: "Opportunity identification",
    text: "We look for technology project opportunities that fit the capabilities of OccasionFun and DGV Group.",
  },
  {
    title: "Bidding and proposals",
    text: "We prepare responses for commercial clients, public-sector buyers and prime contractors.",
  },
  {
    title: "Business engagement",
    text: "OccasionFun is the UK company a client deals with for the relationship, the bid and the project conversation.",
  },
  {
    title: "Project coordination",
    text: "We coordinate scope, communication and handover. Technical execution is carried out by DGV Group.",
  },
];

const deliverySteps = [
  {
    title: "Opportunity identification",
    text: "OccasionFun identifies a technology opportunity that fits the work we can coordinate.",
  },
  {
    title: "Requirement evaluation",
    text: "The requirement, constraints and fit are assessed before any commitment is made.",
  },
  {
    title: "Proposal and planning",
    text: "Scope, responsibilities and a plan are prepared for that opportunity.",
  },
  {
    title: "Technical architecture and design",
    text: "DGV Group plans the technical approach for the agreed work.",
  },
  {
    title: "Development and implementation",
    text: "DGV Group builds and implements the solution.",
  },
  {
    title: "Testing and quality assurance",
    text: "The work is tested against the requirements agreed for the project.",
  },
  {
    title: "Deployment and handover",
    text: "The solution is deployed and handed over with the documentation agreed for that project.",
  },
  {
    title: "Ongoing support where agreed",
    text: "Support continues only when it is part of the engagement.",
  },
];

const whyOccasionFun = [
  {
    title: "Clear business and technical responsibilities",
    text: "OccasionFun leads the commercial relationship and project coordination. DGV Group carries out the technical work.",
  },
  {
    title: "Dedicated technology delivery",
    text: "DGV Group provides technical planning, engineering, development, testing and implementation.",
  },
  {
    title: "Broad technology capabilities",
    text: "The same model covers software, cloud, data, AI, quality engineering, security and managed IT.",
  },
  {
    title: "Structured project execution",
    text: "Work moves through evaluation, planning, build, test and handover, scoped to the individual project.",
  },
  {
    title: "Transparent engagement",
    text: "Clients can see which company coordinates the project and which company delivers the technology.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-role-secondary">
        <Container className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <p className="text-sm font-bold tracking-[0.16em] text-navy-900">
              {company.legalName}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl leading-[1.08] text-balance sm:text-5xl lg:text-[3.35rem]">
              IT services and technology projects, coordinated from the UK.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              OccasionFun Ltd identifies project opportunities, leads bidding
              and business engagement, and coordinates delivery. The technical
              work is carried out by DGV Group, a separate India-registered
              company under common ownership.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/contact">Discuss a project</ButtonLink>
              <ButtonLink href="#services" variant="ghost">
                Explore our services
              </ButtonLink>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Two companies, one ownership
            </p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-navy-900">OccasionFun Ltd</dt>
                <dd className="mt-1 text-slate-600">
                  UK-registered company {company.companyNumber}. Project
                  opportunities, bidding, business engagement and coordination.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-900">DGV Group</dt>
                <dd className="mt-1 text-slate-600">
                  India-registered company. Technical planning, engineering,
                  development, testing and implementation.
                </dd>
              </div>
            </dl>
            <Link
              href="#delivery-model"
              className="mt-5 inline-flex text-sm font-semibold text-accent hover:text-accent-hover"
            >
              How the companies work together
            </Link>
          </aside>
        </Container>
      </section>

      <Section
        id="what-we-do"
        className="scroll-mt-24"
        eyebrow="What we do"
        title="We run the business side of technology projects"
        description="OccasionFun’s role is to find, bid and coordinate the work. The individual technical services are how DGV Group delivers it."
      >
        <ul className="grid gap-6 sm:grid-cols-2">
          {whatWeDo.map((item) => (
            <li key={item.title} className="border-t border-slate-200 pt-5">
              <h3 className="text-xl text-navy-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="delivery-model"
        className="scroll-mt-24"
        tone="muted"
        eyebrow="Our business and delivery model"
        title="OccasionFun coordinates. DGV Group builds."
        description="These are two distinct companies under common ownership. They are not the same legal entity, and DGV Group is not a network of outside suppliers."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              United Kingdom
            </p>
            <h3 className="mt-3 text-2xl text-navy-900">OccasionFun Ltd</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              The UK-registered company clients and buyers contract and
              communicate with for an opportunity.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>Opportunity identification</li>
              <li>Bidding</li>
              <li>Business engagement</li>
              <li>Project coordination</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              India
            </p>
            <h3 className="mt-3 text-2xl text-navy-900">DGV Group</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              The India-registered company that provides the dedicated technical
              delivery for an agreed project.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>Technical planning</li>
              <li>Engineering and development</li>
              <li>Testing</li>
              <li>Implementation</li>
            </ul>
          </article>
        </div>

        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {[
            {
              title: "Engage",
              text: "A client brings an opportunity or requirement to OccasionFun.",
            },
            {
              title: "Shape",
              text: "OccasionFun evaluates the requirement and leads the bid or proposal.",
            },
            {
              title: "Deliver",
              text: "DGV Group plans, builds, tests and implements the technical work.",
            },
            {
              title: "Hand over",
              text: "OccasionFun coordinates acceptance, handover and any support that was agreed.",
            },
          ].map((step, index) => (
            <li key={step.title}>
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                {index < 3 ? (
                  <span
                    aria-hidden="true"
                    className="hidden h-px flex-1 bg-slate-200 md:block"
                  />
                ) : null}
              </div>
              <h3 className="text-lg text-navy-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm leading-relaxed text-slate-600">
          A longer description of the operating relationship is on the{" "}
          <Link
            href="/technology-partner"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            technology partner
          </Link>{" "}
          page, and the company background is on{" "}
          <Link
            href="/about"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            About
          </Link>
          .
        </p>
      </Section>

      <Section
        id="services"
        className="scroll-mt-24"
        eyebrow="Our services"
        title="Technical services, grouped by the work involved"
        description="Every service below already has its own page. The groups show how the capabilities fit together. They are not separate offers."
      >
        <ServiceCatalogue groupHeading="h3" cardHeading="h4" />
        <div className="mt-10">
          <ButtonLink href="/services" variant="ghost">
            View all services
          </ButtonLink>
        </div>
      </Section>

      <Section
        id="how-we-deliver"
        className="scroll-mt-24"
        tone="muted"
        eyebrow="How we deliver projects"
        title="From an opportunity to handover"
        description="A project can move through the stages below. Not every engagement uses every stage, and the contract is agreed for that piece of work."
      >
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {deliverySteps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                Step {index + 1}
              </p>
              <h3 className="mt-2 text-lg text-navy-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <ButtonLink href="/how-we-work" variant="ghost">
            Read how we work
          </ButtonLink>
        </div>
      </Section>

      <Section
        id="experience"
        className="scroll-mt-24"
        eyebrow="Our work"
        title="Project records have their own page"
        description="Services describe what can be undertaken. Published project experience is kept on Our Work, and only when it can be verified."
      >
        <div className="mt-2">
          <ButtonLink href="/our-work" variant="ghost">
            Read Our Work
          </ButtonLink>
        </div>
      </Section>

      <Section
        id="why-occasionfun"
        className="scroll-mt-24"
        tone="muted"
        eyebrow="Why OccasionFun"
        title="A clear split between the relationship and the build"
      >
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {whyOccasionFun.map((item) => (
            <li key={item.title} className="border-t border-slate-200 pt-5">
              <h3 className="text-xl text-navy-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <CTABanner
        title="Discuss a project or opportunity"
        description="Tell us about the requirement, the context and any constraints. OccasionFun will coordinate the response."
        primaryHref="/contact"
        primaryLabel="Discuss a project"
        secondaryHref="/services"
        secondaryLabel="Explore our services"
      />
    </>
  );
}
