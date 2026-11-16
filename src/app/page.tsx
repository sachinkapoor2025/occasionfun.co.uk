import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { CTABanner } from "@/components/ui/CTABanner";
import { Section } from "@/components/ui/Section";
import { ServiceCatalogue } from "@/components/ui/ServiceCatalogue";
import { company, partnershipSummary } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: company.legalName,
  description:
    "UK technology services from OccasionFun Ltd, including client engagement, requirements, bidding and project coordination, delivered with Divit Global Ventures (DGV).",
  path: "/",
});

const whatWeDo = [
  {
    title: "Client engagement",
    text: "OccasionFun engages UK businesses, public-sector buyers and prime contractors, and keeps the client conversation.",
  },
  {
    title: "Requirements and bidding",
    text: "We gather requirements and prepare proposals for commercial clients, public-sector buyers and prime contractors.",
  },
  {
    title: "Project coordination",
    text: "We coordinate scope, communication and handover, and support delivery of the technology project.",
  },
  {
    title: "Technology delivery",
    text: "DGV designs, develops and delivers digital platforms and software for clients. OccasionFun coordinates that work with the client.",
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
    text: "DGV designs the digital platform or software for the client.",
  },
  {
    title: "Development and implementation",
    text: "DGV develops and delivers the solution for the client.",
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
    text: "OccasionFun handles UK client engagement, requirements, bidding and project coordination. DGV designs, develops and delivers the technology for clients.",
  },
  {
    title: "Dedicated technology delivery",
    text: "DGV is a technology delivery company. It provides IT services, software development and technical project delivery for clients under a signed agreement.",
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
              {partnershipSummary}
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
              Separate legal entities
            </p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-navy-900">OccasionFun Ltd</dt>
                <dd className="mt-1 text-slate-600">
                  UK technology services company {company.companyNumber}. Client
                  engagement, requirements, bidding, coordination and communication.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-900">DGV</dt>
                <dd className="mt-1 text-slate-600">
                  Technology delivery partner. Designs, develops and delivers IT
                  solutions and digital platforms for clients.
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
        title="Technology services, coordinated from the UK"
        description="OccasionFun engages clients, understands their requirements and coordinates technology projects. DGV designs, develops and delivers the IT solutions and digital platforms."
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
        title="OccasionFun coordinates. DGV designs, develops and delivers."
        description="OccasionFun Ltd and DGV are separate legal entities under common ownership and work under a signed agreement. DGV is a technology delivery company. It designs, develops and delivers IT solutions and digital platforms for clients."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              United Kingdom
            </p>
            <h3 className="mt-3 text-2xl text-navy-900">OccasionFun Ltd</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              UK technology services: client engagement, requirements, bidding,
              coordination and support for delivery.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>Client engagement and communication</li>
              <li>Requirements and bidding</li>
              <li>Project coordination</li>
              <li>Support for technology delivery</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Technology partner
            </p>
            <h3 className="mt-3 text-2xl text-navy-900">DGV</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A technology delivery company. Provides IT services, software
              development, application engineering and technical project
              delivery for clients.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>IT services and software development</li>
              <li>Application engineering</li>
              <li>Design and development of digital platforms</li>
              <li>Technical project delivery</li>
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
              text: "DGV designs, develops and delivers the digital platform or software for the client.",
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
        description="Four selected technology projects are published as on-site case studies. They describe the software that was built. They do not name a client or a result."
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
