import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { partnershipShort } from "@/config/company";
import { caseStudies } from "@/content/case-studies";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Our work",
  description:
    "Four selected technology projects — UsaRakhi, BlossomPot, SpicyCenter and HalloweenReady — delivered with Divit Global Ventures (DGV). Each card opens an on-site case study.",
  path: "/our-work",
});

const relatedServices = [
  {
    href: "/services/software-development",
    title: "Software and application development",
    text: "Custom applications, APIs and business software. The case studies on this page are examples of that engineering work.",
  },
  {
    href: "/services/cloud-aws-devops",
    title: "Cloud, AWS and DevOps",
    text: "The same projects use AWS services for data, compute, storage and authentication. Scope is still agreed per engagement.",
  },
];

export default function OurWorkPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our work"
        title="Selected technology projects"
        description={`${partnershipShort} The four projects below were delivered through that working relationship. Each card opens an on-site case study describing the technology. The pages do not name a client, a budget or a result.`}
      />

      <section className="bg-role-primary py-10 sm:py-12">
        <Container>
          <ul className="grid gap-8 md:grid-cols-2">
            {caseStudies.map((project) => (
              <li key={project.slug}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <Link
                    href={`/our-work/${project.slug}`}
                    className="block bg-slate-50"
                  >
                    <img
                      src={project.image}
                      alt={project.alt}
                      width={project.imageWidth}
                      height={project.imageHeight}
                      loading="lazy"
                      decoding="async"
                      className="h-auto w-full"
                    />
                  </Link>
                  <div className="flex flex-1 flex-col p-6 sm:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                      Case study
                    </p>
                    <h2 className="mt-3 text-2xl text-navy-900">
                      <Link
                        href={`/our-work/${project.slug}`}
                        className="hover:text-accent"
                      >
                        {project.name}
                      </Link>
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {project.summary}
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {project.capabilities.map((label) => (
                        <li
                          key={label}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-navy-800"
                        >
                          {label}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6">
                      <ButtonLink
                        href={`/our-work/${project.slug}`}
                        variant="ghost"
                        aria-label={`Read the ${project.name} case study`}
                      >
                        Read Case Study
                      </ButtonLink>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Section
        tone="muted"
        title="Related services"
        description="These projects are software platforms delivered on AWS. They are not WordPress sites."
      >
        <ul className="grid gap-6 sm:grid-cols-2">
          {relatedServices.map((service) => (
            <li key={service.href} className="border-t border-slate-200 pt-5">
              <h3 className="text-xl text-navy-900">
                <Link href={service.href} className="hover:text-accent">
                  {service.title}
                </Link>
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {service.text}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="How a project is taken forward">
        <p className="max-w-3xl text-base leading-relaxed text-slate-600">
          OccasionFun engages the client, agrees the requirement and coordinates
          the work. DGV designs, develops and delivers the software. The stages
          are described on the how-we-work page.
        </p>
        <div className="mt-6">
          <ButtonLink href="/how-we-work" variant="ghost">
            Read how we work
          </ButtonLink>
        </div>
      </Section>

      <section className="bg-role-primary pb-10 sm:pb-12">
        <Container>
          <div className="rounded-2xl bg-role-emphasis px-6 py-10 sm:px-10 sm:py-12">
            <h2 className="text-3xl text-white sm:text-4xl">Discuss a project</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-200">
              Tell OccasionFun about a requirement. These case studies describe
              technology that has been built. They are not a proposal or a
              record of results.
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
