import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { CTABanner } from "@/components/ui/CTABanner";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import {
  getAllServiceSlugs,
  getRelatedServices,
  getServiceBySlug,
} from "@/content/services";
import { createPageMetadata } from "@/lib/seo";

type ServicePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllServiceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) {
    return {};
  }

  return createPageMetadata({
    title: service.title,
    description: service.introduction,
    path: `/services/${service.slug}`,
  });
}

export default async function ServiceDetailPage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const related = getRelatedServices(service);

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="border-b border-slate-200/80 bg-role-primary"
      >
        <Container className="py-3">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <li>
              <Link
                href="/services"
                className="font-semibold text-accent hover:text-accent-hover"
              >
                Services
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-navy-900">
              {service.title}
            </li>
          </ol>
        </Container>
      </nav>

      <PageHeader
        eyebrow="Service"
        title={service.title}
        description={service.introduction}
      />

      <Section title="What you can engage us to do">
        <ul className="grid gap-3 sm:grid-cols-2">
          {service.covers.map((item) => (
            <li
              key={item}
              className="border-l-2 border-accent/40 pl-4 text-sm leading-relaxed text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        tone="muted"
        title="Situations this is relevant to"
        description="Common situations where this capability is relevant. These are general examples, not claims about specific clients."
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {service.challenges.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Examples of what a scoped piece of work can include"
        description="Illustrative outputs only. They are not presented as completed client work."
      >
        <ul className="space-y-3">
          {service.exampleDeliverables.map((item) => (
            <li
              key={item}
              className="flex gap-3 text-sm leading-relaxed text-slate-700"
            >
              <ChevronRight
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                strokeWidth={1.75}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted" title="How a requirement is taken forward">
        <p className="max-w-3xl text-base leading-relaxed text-slate-600">
          {service.engagement}
        </p>
        <div className="mt-6">
          <ButtonLink href="/how-we-work" variant="ghost">
            View our delivery lifecycle
          </ButtonLink>
        </div>
      </Section>

      <Section title="Boundaries and safeguards">
        <p className="max-w-3xl text-base leading-relaxed text-slate-600">
          {service.securityNotes}
        </p>
      </Section>

      <Section
        tone="muted"
        title="Related services"
        description="Nearby services are separate pages. The note under each name says how it differs."
      >
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((item) => (
            <li key={item.slug} className="border-t border-slate-200 pt-5">
              <h3 className="text-xl text-navy-900">
                <Link
                  href={`/services/${item.slug}`}
                  className="transition-colors hover:text-accent"
                >
                  {item.title}
                </Link>
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {item.distinction}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <CTABanner
        title={`Discuss ${service.title}`}
        description="Share your objectives, constraints and timelines. We will respond through our UK business engagement route."
        primaryHref="/contact"
        primaryLabel="Discuss a requirement"
        secondaryHref="/services"
        secondaryLabel="Explore our services"
      />
    </>
  );
}
