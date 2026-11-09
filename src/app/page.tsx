import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { CTABanner } from "@/components/ui/CTABanner";
import { Section } from "@/components/ui/Section";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { SupplierInfoPanel } from "@/components/ui/SupplierInfoPanel";
import { company, positioning } from "@/config/company";
import { services } from "@/content/services";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: company.legalName,
  description: positioning.supportingMessage,
  path: "/",
});

const howWeWorkPreview = [
  "Clarify requirements, constraints and acceptance criteria",
  "Agree scope, roles, security and delivery locations",
  "Build, test and demonstrate against agreed outcomes",
  "Hand over with documentation and defined support",
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-200/80">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 surface-grid opacity-50"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_30%,rgba(15,118,110,0.16),transparent_55%)]"
        />
        <Container className="relative grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="animate-fade-in text-sm font-bold tracking-[0.16em] text-navy-900">
              {company.legalName}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl sm:text-5xl lg:text-[3.35rem] leading-[1.08] text-balance animate-fade-up">
              {positioning.homepageHeadline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 animate-fade-up [animation-delay:90ms]">
              {positioning.homepageSubheading}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 animate-fade-up [animation-delay:140ms]">
              <ButtonLink href="/contact">Discuss a requirement</ButtonLink>
              <ButtonLink href="/services" variant="ghost">
                Explore our services
              </ButtonLink>
              <ButtonLink href="/public-sector" variant="secondary">
                Supplier and procurement enquiries
              </ButtonLink>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-[var(--shadow-soft)] animate-fade-in [animation-delay:180ms]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              UK company identity
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-navy-900">Legal name</dt>
                <dd className="text-slate-600">{company.legalName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-900">Company number</dt>
                <dd className="text-slate-600">{company.companyNumber}</dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-900">Jurisdiction</dt>
                <dd className="text-slate-600">{company.jurisdiction}</dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-900">Delivery model</dt>
                <dd className="text-slate-600">
                  UK business engagement with specialist technology delivery
                  through partner {company.dgvDisplayName} where appropriate and
                  approved.
                </dd>
              </div>
            </dl>
            <Link
              href="/about"
              className="mt-5 inline-flex text-sm font-semibold text-accent hover:text-accent-hover"
            >
              About our operating model →
            </Link>
          </aside>
        </Container>
      </section>

      <Section
        eyebrow="Capabilities"
        title="Technology services organised around clear outcomes"
        description="We help organisations plan, build, improve and support digital services across cloud, software, data, quality engineering and web platforms."
      >
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
      </Section>

      <Section
        tone="muted"
        eyebrow="How we work"
        title="A practical delivery rhythm"
        description="Governance, reporting and change control are agreed in the statement of work or contract—not assumed."
      >
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {howWeWorkPreview.map((item, index) => (
            <li
              key={item}
              className="border-l-2 border-accent/40 pl-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                Step {index + 1}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{item}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <ButtonLink href="/how-we-work" variant="ghost">
            View the full delivery lifecycle
          </ButtonLink>
        </div>
      </Section>

      <Section
        eyebrow="Technology partner"
        title={`${company.dgvDisplayName} supports specialist engineering delivery`}
        description={`${company.legalName} remains the contracting-facing company. ${company.dgvDisplayName} is a technology and engineering partner used where appropriate to the engagement and subject to client requirements.`}
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Clear ownership",
              text: "Client engagement and delivery coordination sit with OCCASIONFUN LTD.",
            },
            {
              title: "Transparent subcontracting",
              text: "Delivery locations, access and responsibilities are disclosed as required by the contract or tender.",
            },
            {
              title: "Client approval first",
              text: "Where a contract requires approval before subcontracting or overseas access, we seek that approval before proceeding.",
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
        <div className="mt-8">
          <ButtonLink href="/technology-partner" variant="ghost">
            Read the technology partner model
          </ButtonLink>
        </div>
      </Section>

      <Section
        tone="navy"
        eyebrow="Public sector and commercial"
        title="Built for procurement scrutiny and commercial clarity"
        description="Whether you are a contracting authority, prime contractor or commercial client, we focus on verifiable company identity, transparent delivery arrangements and proportionate governance."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/public-sector">Public-sector overview</ButtonLink>
          <ButtonLink
            href="/contact?enquiryType=Public-sector%20procurement"
            variant="ghost"
            className="border-white/20 text-white hover:bg-white/10 hover:border-white/40"
          >
            Supplier and procurement enquiries
          </ButtonLink>
        </div>
      </Section>

      <Section>
        <SupplierInfoPanel />
      </Section>

      <CTABanner />
    </>
  );
}
