import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { digitalProjects } from "@/content/projects";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Our work",
  description:
    "Selected digital platforms across gifting, seasonal retail and specialist product categories. Shown as project previews, not as client case studies or measured results.",
  path: "/our-work",
});

const relatedServices = [
  {
    href: "/services/software-development",
    title: "Software and application development",
    text: "Custom web applications, APIs and business software.",
  },
  {
    href: "/services/wordpress-web",
    title: "WordPress and web development",
    text: "Corporate and content-managed websites.",
  },
];

function ExternalMark() {
  return (
    <>
      <span aria-hidden="true">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </>
  );
}

export default function OurWorkPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our work"
        title="Selected Digital Projects"
        description="Explore a selection of digital platforms across gifting, seasonal retail and specialist product categories. These projects demonstrate different types of online experiences, business requirements and digital capabilities. They are shown as selected digital projects. Commissioning, ownership and results are not stated on this page."
      />

      <section className="bg-role-primary py-10 sm:py-12">
        <Container>
          <ul className="grid gap-8 md:grid-cols-2">
            {digitalProjects.map((project) => (
              <li key={project.href}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <a
                    href={project.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${project.alt} Opens in a new tab.`}
                    className="block bg-slate-50"
                  >
                    <img
                      src={project.image}
                      alt={project.alt}
                      width={project.imageWidth}
                      height={project.imageHeight}
                      className="h-auto w-full"
                    />
                  </a>
                  <div className="flex flex-1 flex-col p-6 sm:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                      Selected digital project
                    </p>
                    <h2 className="mt-3 text-2xl text-navy-900">
                      <a
                        href={project.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 hover:text-accent"
                      >
                        {project.name}
                        <ExternalMark />
                      </a>
                    </h2>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                      {project.description}
                    </p>
                    <div className="mt-6">
                      <a
                        href={project.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-5 py-3 text-sm font-semibold text-navy-900 hover:border-navy-700 hover:bg-white"
                      >
                        Visit website
                        <ExternalMark />
                      </a>
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
        title="Capabilities these experiences relate to"
        description="The links below are service descriptions. They do not state which technology was used on a project, or any contract or result."
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
          The lifecycle, and which company does each part, is explained
          separately. It is not repeated here.
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
              Tell OccasionFun about a requirement. This page is not a proposal
              or a record of results.
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
