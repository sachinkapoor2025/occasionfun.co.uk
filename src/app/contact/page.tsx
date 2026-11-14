import { Briefcase, FileText, Landmark } from "lucide-react";
import { Suspense } from "react";
import { ContactForm } from "@/components/forms/ContactForm";
import { Container } from "@/components/ui/Container";
import { company } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Contact",
  description:
    "Contact OCCASIONFUN LTD about technology services, public-sector procurement, or supplier information requests.",
  path: "/contact",
});

const enquiryTopics = [
  { title: "Project requirements", icon: Briefcase },
  { title: "Procurement opportunities", icon: Landmark },
  { title: "Supplier information", icon: FileText },
] as const;

function ContactFormFallback() {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 sm:p-8"
      role="status"
    >
      Loading contact form…
    </div>
  );
}

export default function ContactPage() {
  return (
    <section className="bg-role-secondary py-8 sm:py-10">
      <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="order-1 lg:order-0 lg:col-start-1 lg:row-start-1">
          <h1 className="text-balance text-3xl text-navy-900 sm:text-4xl">
            Let&apos;s discuss your project.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Tell us about a technology requirement, procurement opportunity or
            supplier enquiry. OccasionFun Ltd receives the enquiry and
            coordinates the engagement.
          </p>
          <ul className="mt-6 space-y-3">
            {enquiryTopics.map(({ title, icon: Icon }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-navy-900">{title}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="order-2 lg:order-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Suspense fallback={<ContactFormFallback />}>
            <ContactForm />
          </Suspense>
        </div>

        <aside className="order-3 lg:order-0 lg:col-start-1 lg:row-start-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg text-navy-900">Company</h2>
            <p className="mt-3 text-sm font-semibold text-navy-900">
              {company.legalName}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Company number {company.companyNumber}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Office address, email and telephone are not published on this
              page.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              No response time is published.
            </p>
          </div>
        </aside>
      </Container>
    </section>
  );
}
