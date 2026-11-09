import { PageHeader } from "@/components/ui/PageHeader";
import { ReviewWarning } from "@/components/ui/ReviewWarning";
import { Section } from "@/components/ui/Section";
import { company, displayOrPending } from "@/config/company";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Privacy notice",
  description:
    "Draft privacy notice for the OCCASIONFUN LTD website. Requires legal review before launch reliance.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Privacy notice"
        description="Draft placeholder notice for website visitors and enquiry respondents. Final wording, lawful bases, retention periods and contact details require legal review."
      />

      <Section>
        <ReviewWarning />
        <div className="prose-like max-w-3xl space-y-6 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-xl text-navy-900">Who we are</h2>
            <p className="mt-3">
              This website is operated by {company.legalName}, company number{" "}
              {company.companyNumber}, registered in the {company.jurisdiction}.
              Registered office:{" "}
              {displayOrPending(
                company.registeredOffice,
                "[to be inserted after verification]",
              )}
              . Privacy contact:{" "}
              {displayOrPending(
                company.privacyEmail,
                "[to be inserted after approval]",
              )}
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Information we may collect</h2>
            <p className="mt-3">
              If you submit the contact form, we may collect your name,
              organisation, work email, phone number (if provided), enquiry type
              and message content, together with technical metadata needed to
              secure the form (such as approximate request timing and network
              identifiers used for rate limiting).
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">How we use information</h2>
            <p className="mt-3">
              Enquiry details are used to respond to your request and, where
              relevant, to manage supplier or commercial follow-up. We do not
              invent or assert specific lawful bases, retention periods or
              processor lists here until legally reviewed and approved.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Sharing and international access</h2>
            <p className="mt-3">
              Where technology partner {company.dgvDisplayName} or another
              partner may need access to personal data to support a response or
              engagement, that access will be assessed against UK data-protection
              requirements. International transfer mechanisms are not claimed as
              already executed unless confirmed.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Your rights</h2>
            <p className="mt-3">
              Depending on applicable law, you may have rights to access,
              rectify, erase, restrict or object to certain processing, and to
              complain to the Information Commissioner&apos;s Office. Contact
              details for exercising rights will be confirmed after privacy
              contact approval.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Updates</h2>
            <p className="mt-3">
              This draft will be replaced with an approved privacy notice before
              public launch reliance.
            </p>
          </section>
        </div>
      </Section>
    </>
  );
}
