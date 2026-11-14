import { ButtonLink } from "./Button";
import { Container } from "./Container";

export function CTABanner({
  title = "Discuss a requirement",
  description = "Tell us about your project, procurement enquiry or delivery need. We will respond through our UK business engagement route.",
  primaryHref = "/contact",
  primaryLabel = "Contact OCCASIONFUN LTD",
  secondaryHref = "/services",
  secondaryLabel = "Explore our services",
}: {
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="bg-role-primary py-10 sm:py-12">
      <Container>
        <div className="rounded-2xl bg-role-emphasis px-6 py-10 sm:px-10 sm:py-12 shadow-[var(--shadow-soft)]">
          <div className="max-w-2xl">
            <h2 className="text-3xl text-white sm:text-4xl">{title}</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-200">
              {description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={primaryHref} variant="primary">
                {primaryLabel}
              </ButtonLink>
              <ButtonLink
                href={secondaryHref}
                variant="ghost"
                className="border-white/20 text-white hover:bg-white/10 hover:border-white/40"
              >
                {secondaryLabel}
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
