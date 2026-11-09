import { PageHeader } from "@/components/ui/PageHeader";
import { ReviewWarning } from "@/components/ui/ReviewWarning";
import { Section } from "@/components/ui/Section";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Cookie notice",
  description:
    "Draft cookie notice for OCCASIONFUN LTD. Essential cookies are distinguished from optional analytics cookies, which are not loaded before consent.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Cookie notice"
        description="Draft notice describing how cookies and similar technologies are handled on this website. Final inventory and wording require legal review."
      />

      <Section>
        <ReviewWarning />
        <div className="max-w-3xl space-y-6 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-xl text-navy-900">Essential cookies</h2>
            <p className="mt-3">
              Essential cookies or local storage values may be used to remember
              cookie preferences and to support secure operation of the website
              and contact form. These are required for basic functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Optional analytics or marketing cookies</h2>
            <p className="mt-3">
              No analytics or marketing provider is installed by default. If the
              company later approves an analytics configuration, optional cookies
              will only be activated after consent where consent is required. The
              cookie banner records an essential-only or allow-optional
              preference in local storage.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Current cookie inventory</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-4 font-semibold text-navy-900">Name</th>
                    <th className="py-2 pr-4 font-semibold text-navy-900">Type</th>
                    <th className="py-2 font-semibold text-navy-900">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200 align-top">
                    <td className="py-3 pr-4">occasionfun-cookie-consent</td>
                    <td className="py-3 pr-4">Essential (local storage)</td>
                    <td className="py-3">
                      Stores whether the visitor chose essential-only or optional
                      cookie consent.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              Additional third-party cookies must be documented here before they
              are enabled in production.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Managing preferences</h2>
            <p className="mt-3">
              You can clear site data in your browser to reset the stored
              preference. A preference-management control can be expanded once
              an analytics provider is selected and approved.
            </p>
          </section>
        </div>
      </Section>
    </>
  );
}
