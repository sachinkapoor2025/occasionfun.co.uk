import Link from "next/link";
import type { Service } from "@/content/services";

export function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="group flex h-full flex-col border-b border-slate-200 py-6 transition-colors hover:border-accent/40 sm:border-b-0 sm:border-l sm:border-slate-200 sm:pl-6 sm:py-0">
      <h3 className="text-xl text-navy-900 group-hover:text-accent transition-colors">
        <Link href={`/services/${service.slug}`} className="focus-visible:outline-accent">
          {service.title}
        </Link>
      </h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
        {service.summary}
      </p>
      <Link
        href={`/services/${service.slug}`}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-navy-900 group-hover:text-accent"
      >
        Explore service
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
          →
        </span>
      </Link>
    </article>
  );
}
