import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import {
  caseStudies,
  getAllCaseStudySlugs,
  getCaseStudy,
} from "@/content/case-studies";
import { createPageMetadata } from "@/lib/seo";

type CaseStudyPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllCaseStudySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: CaseStudyPageProps) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) {
    return {};
  }

  return createPageMetadata({
    title: `${study.name} case study`,
    description: study.metaDescription,
    path: `/our-work/${study.slug}`,
    image: study.image,
  });
}

export default async function CaseStudyPage({ params }: CaseStudyPageProps) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) {
    notFound();
  }

  const related = caseStudies.filter((item) => item.slug !== study.slug);

  return (
    <>
      <PageHeader
        eyebrow="Case study"
        title={study.name}
        description={study.summary}
      />

      <section className="bg-role-primary py-10 sm:py-12">
        <Container>
          <img
            src={study.image}
            alt={study.alt}
            width={study.imageWidth}
            height={study.imageHeight}
            className="h-auto w-full rounded-2xl border border-slate-200"
          />
          <ul className="mt-6 flex flex-wrap gap-2">
            {study.capabilities.map((label) => (
              <li
                key={label}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-navy-800"
              >
                {label}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {study.sections.map((section, index) => (
        <Section
          key={section.title}
          tone={index % 2 === 0 ? "muted" : "default"}
          title={section.title}
        >
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-slate-600">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </Section>
      ))}

      <Section
        title="Related services"
        description="These platforms are custom software on AWS. They are not WordPress builds."
      >
        <ul className="grid gap-6 sm:grid-cols-2">
          <li className="border-t border-slate-200 pt-5">
            <h3 className="text-xl text-navy-900">
              <Link
                href="/services/software-development"
                className="hover:text-accent"
              >
                Software and application development
              </Link>
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Application engineering for catalogues, checkout and
              administration.
            </p>
          </li>
          <li className="border-t border-slate-200 pt-5">
            <h3 className="text-xl text-navy-900">
              <Link
                href="/services/cloud-aws-devops"
                className="hover:text-accent"
              >
                Cloud, AWS and DevOps
              </Link>
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Serverless data, compute, storage and authentication used by
              these platforms.
            </p>
          </li>
        </ul>
      </Section>

      <Section
        tone="muted"
        title="Other case studies"
        description="Each link stays on this website."
      >
        <ul className="grid gap-6 sm:grid-cols-3">
          {related.map((item) => (
            <li key={item.slug} className="border-t border-slate-200 pt-5">
              <h3 className="text-xl text-navy-900">
                <Link
                  href={`/our-work/${item.slug}`}
                  className="hover:text-accent"
                >
                  {item.name}
                </Link>
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {item.capabilities.slice(0, 2).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <ButtonLink href="/our-work" variant="ghost">
            Back to our work
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
