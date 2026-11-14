import {
  BrainCircuit,
  ClipboardCheck,
  Cloud,
  CodeXml,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { getServiceBySlug, serviceGroups } from "@/content/services";
import { ServiceCard } from "./ServiceCard";

const categoryIcons: Record<string, LucideIcon> = {
  "Software and Web Development": CodeXml,
  "Cloud, Infrastructure and DevOps": Cloud,
  "AI, Data and Automation": BrainCircuit,
  "Quality Engineering and Testing": ClipboardCheck,
  Cybersecurity: ShieldCheck,
  "Managed IT Services": Server,
};

export function ServiceCatalogue({
  groupHeading = "h2",
  cardHeading = "h3",
}: {
  groupHeading?: "h2" | "h3";
  cardHeading?: "h3" | "h4";
}) {
  const GroupHeading = groupHeading;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      {serviceGroups.map((group) => {
        const Icon = categoryIcons[group.title];
        return (
          <section key={group.title} className="min-w-0">
            <div className="flex items-start gap-3">
              {Icon ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </span>
              ) : null}
              <GroupHeading className="text-2xl text-navy-900 sm:text-3xl">
                {group.title}
              </GroupHeading>
            </div>
            <div className="mt-5 grid gap-4">
              {group.slugs.map((slug) => {
                const service = getServiceBySlug(slug);
                if (!service) return null;
                return (
                  <ServiceCard
                    key={service.slug}
                    service={service}
                    headingLevel={cardHeading}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
