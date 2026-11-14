import Link from "next/link";
import type { Service } from "@/content/services";

export function ServiceCard({
  service,
  headingLevel = "h3",
}: {
  service: Service;
  /** Use h4 when the card sits under a group heading that is already an h3. */
  headingLevel?: "h3" | "h4";
}) {
  const Heading = headingLevel;

  return (
    <article className="group relative h-full rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-accent/50">
      <Heading className="font-display text-xl tracking-[-0.02em] text-navy-900">
        <Link
          href={`/services/${service.slug}`}
          className="inline-flex items-start gap-2 transition-colors hover:text-accent after:absolute after:inset-0"
        >
          {service.title}
          <span
            aria-hidden="true"
            className="mt-1 transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      </Heading>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        {service.cardText}
      </p>
    </article>
  );
}
