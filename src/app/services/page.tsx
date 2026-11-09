import { CTABanner } from "@/components/ui/CTABanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { services } from "@/content/services";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Services",
  description:
    "Explore OCCASIONFUN LTD services across cloud and DevOps, software development, AI solutions, QA automation, WordPress and web, data engineering, secure engineering and managed IT support.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="Technology services with clear scope and accountable delivery"
        description="Each service area is designed to help buyers and commercial teams understand what we cover, how we engage, and which security and acceptance considerations typically apply."
      />

      <Section>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-slate-500">
          Example deliverables on service pages are illustrative. They are not
          presented as completed client case studies.
        </p>
      </Section>

      <CTABanner
        title="Not sure which service fits?"
        description="Describe the outcome you need. We will help map it to the right capability and engagement approach."
        secondaryHref="/how-we-work"
        secondaryLabel="See how we work"
      />
    </>
  );
}
