import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { CTABanner } from "@/components/ui/CTABanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import {
  getAllServiceSlugs,
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
    description: service.summary,
    path: `/services/${service.slug}`,
  });
}

export default async function ServiceDetailPage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Service"
        title={service.title}
        description={service.summary}
      />

      <Section title="What this service covers">
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
        title="Typical client challenges"
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
        title="Example deliverables"
        description="Illustrative outputs only. They are not presented as completed client work."
      >
        <ul className="space-y-3">
          {service.exampleDeliverables.map((item) => (
            <li
              key={item}
              className="flex gap-3 text-sm leading-relaxed text-slate-700"
            >
              <span aria-hidden="true" className="mt-1 text-accent">
                ▸
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Engagement approach">
        <p className="max-w-3xl text-base leading-relaxed text-slate-600">
          {service.engagement}
        </p>
        <div className="mt-6">
          <ButtonLink href="/how-we-work" variant="ghost">
            View our delivery lifecycle
          </ButtonLink>
        </div>
      </Section>

      <Section
        tone="muted"
        title="Security, data and acceptance considerations"
      >
        <p className="max-w-3xl text-base leading-relaxed text-slate-600">
          {service.securityNotes}
        </p>
      </Section>

      <CTABanner
        title={`Discuss ${service.shortTitle.toLowerCase()} requirements`}
        description="Share your objectives, constraints and timelines. We will respond through our UK business engagement route."
        primaryHref="/contact"
        primaryLabel="Discuss a requirement"
      />
    </>
  );
}
