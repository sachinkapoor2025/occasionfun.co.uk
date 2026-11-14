import Link from "next/link";
import { CTABanner } from "@/components/ui/CTABanner";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServiceCatalogue } from "@/components/ui/ServiceCatalogue";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Services",
  description:
    "Technical services that can be scoped for a project: software, web, cloud, AI, data, testing, secure engineering and managed support.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="Technical work that can be scoped for a project."
        description="Each service below is a capability. Scope, acceptance and who does the work are agreed for that requirement."
      />

      <section className="bg-role-primary py-10 sm:py-12">
        <Container>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            OccasionFun coordinates the engagement. How the work is split with
            DGV Group is explained on the{" "}
            <Link
              href="/technology-partner"
              className="font-semibold text-accent hover:text-accent-hover"
            >
              technology partner
            </Link>{" "}
            page.
          </p>

          <div className="mt-8">
            <ServiceCatalogue />
          </div>

          <p className="mt-10 max-w-3xl text-sm leading-relaxed text-slate-500">
            Example deliverables on service pages are illustrative. They are not
            presented as completed client case studies.
          </p>
        </Container>
      </section>

      <CTABanner
        title="Not sure which service fits?"
        description="Describe the requirement. OccasionFun will help identify which service applies and what would need to be agreed."
        primaryHref="/contact"
        primaryLabel="Discuss a requirement"
        secondaryHref="/how-we-work"
        secondaryLabel="See how we work"
      />
    </>
  );
}
