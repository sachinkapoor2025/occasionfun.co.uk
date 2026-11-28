import { CookiePreferences } from "@/components/cookies/CookiePreferences";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReviewWarning } from "@/components/ui/ReviewWarning";
import { Section } from "@/components/ui/Section";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Cookie notice",
  description:
    "Draft cookie notice for OCCASIONFUN LTD. Essential storage is separate from optional analytics consent. Analytics collection starts only after you allow it.",
  path: "/cookies",
  indexable: false,
});

export default function CookiesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Cookie notice"
        description="Draft notice describing how this website stores a cookie choice. Final inventory and wording require legal review."
      />

      <Section>
        <ReviewWarning />
        <div className="max-w-3xl space-y-6 text-sm leading-relaxed text-slate-600">
          <CookiePreferences />

          <section>
            <h2 className="text-xl text-navy-900">Essential storage</h2>
            <p className="mt-3">
              Essential storage is used for necessary website functionality. That
              includes remembering your cookie choice and operating the contact
              form. Essential storage remains available if you do not allow
              analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Optional analytics</h2>
            <p className="mt-3">
              You can allow or withdraw optional analytics consent in Cookie
              settings. The choice is stored only in this browser, under a
              versioned consent record. A choice made before this version does
              not allow analytics and the banner asks you to choose again.
            </p>
            <p className="mt-3">
              If you allow analytics, this website stores a first-party page view
              for pages you open afterwards. That record can include the page,
              the time, a coarse device and browser category, the referring site
              name, and a random visitor reference stored in this browser. It
              does not include your IP address. Allowing analytics does not use
              Google Analytics, Google Tag Manager, or another third-party
              analytics service.
            </p>
            <p className="mt-3">
              Choosing essential only stops further collection and removes the
              analytics references from this browser. Records already stored are
              kept for up to 90 days and then expire. This notice is still a
              draft and needs legal review. It describes the collection the site
              performs after consent. It does not state a reviewed lawful basis.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Current storage inventory</h2>
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
                      Stores the versioned cookie choice for this browser:
                      essential only, or analytics allowed.
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 align-top">
                    <td className="py-3 pr-4">occasionfun-analytics-visitor-id</td>
                    <td className="py-3 pr-4">Analytics (local storage)</td>
                    <td className="py-3">
                      A random visitor reference, written only after you allow
                      analytics. It is removed when you return to essential only.
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 align-top">
                    <td className="py-3 pr-4">occasionfun-analytics-session-id</td>
                    <td className="py-3 pr-4">Analytics (session storage)</td>
                    <td className="py-3">
                      A random reference for this browser session, written only
                      after you allow analytics.
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 align-top">
                    <td className="py-3 pr-4">occasionfun-analytics-withdrawal-blocked</td>
                    <td className="py-3 pr-4">Essential (local storage)</td>
                    <td className="py-3">
                      Stored only when analytics withdrawal cannot replace the
                      previous choice. It keeps analytics off until a later
                      choice is saved and checked. It stores no identifier.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              Additional third-party cookies must be documented here before they
              are enabled. None are enabled in this release.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-navy-900">Managing preferences</h2>
            <p className="mt-3">
              Use Cookie settings on this page to review the current choice,
              allow analytics, or return to essential only. Choosing essential
              only withdraws analytics consent for this browser. If the browser
              cannot save the choice, the page says so and does not treat the
              change as complete.
            </p>
          </section>
        </div>
      </Section>
    </>
  );
}
