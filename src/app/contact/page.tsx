import { Suspense } from "react";
import { ContactForm } from "@/components/forms/ContactForm";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { company, displayOrPending } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Contact",
  description:
    "Contact OCCASIONFUN LTD about technology services, public-sector procurement, or supplier information requests.",
  path: "/contact",
});

function ContactFormFallback() {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-sm text-slate-600"
      role="status"
    >
      Loading contact form…
    </div>
  );
}

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Discuss a requirement or request supplier information"
        description="Tell us about your organisation and enquiry. We validate submissions server-side and protect the form against basic spam."
      />

      <section className="py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl text-navy-900">Company identity</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-semibold text-navy-900">Legal name</dt>
                  <dd className="text-slate-600">{company.legalName}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-navy-900">Company number</dt>
                  <dd className="text-slate-600">{company.companyNumber}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-navy-900">Registered office</dt>
                  <dd className="text-slate-600">
                    {displayOrPending(
                      company.registeredOffice,
                      "Pending verification",
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-navy-900">General email</dt>
                  <dd className="text-slate-600">
                    {displayOrPending(
                      company.businessEmail,
                      "Pending approval",
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-navy-900">Telephone</dt>
                  <dd className="text-slate-600">
                    {displayOrPending(
                      company.businessPhone,
                      "Pending approval",
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              Private personal email addresses and phone numbers are not
              published without approval. Enquiries submitted through this form
              are reviewed through the company&apos;s business mailbox once
              notification delivery is configured.
            </p>
          </aside>

          <Suspense fallback={<ContactFormFallback />}>
            <ContactForm />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
