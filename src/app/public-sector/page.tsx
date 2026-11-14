import Link from "next/link";
import { CTABanner } from "@/components/ui/CTABanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { SupplierInfoPanel } from "@/components/ui/SupplierInfoPanel";
import { company, displayOrPending } from "@/config/company";
import { getServiceBySlug, serviceGroups } from "@/content/services";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Public sector and procurement",
  description:
    "Supplier overview for UK public-sector and prime-contractor engagement with OCCASIONFUN LTD, including delivery model transparency and tender-specific compliance approach.",
  path: "/public-sector",
});

export default function PublicSectorPage() {
  return (
    <>
      <PageHeader
        eyebrow="Public sector"
        title="Engaging with UK public-sector organisations and prime contractors"
        description={`${company.legalName} is interested in suitable IT requirements, subject to each procurement's eligibility and selection criteria. Tender readiness is assessed requirement by requirement—not claimed as a blanket status.`}
      />

      <Section>
        <SupplierInfoPanel />
      </Section>

      <Section
        tone="muted"
        title="Supplier overview"
        description="Core identity details for due diligence orientation."
      >
        <dl className="grid gap-5 sm:grid-cols-2">
          {[
            ["Legal name", company.legalName],
            ["Company number", company.companyNumber],
            ["Jurisdiction", company.jurisdiction],
            [
              "Registered office",
              displayOrPending(
                company.registeredOffice,
                "To be inserted after verification",
              ),
            ],
          ].map(([label, value]) => (
            <div key={label} className="border-t border-slate-200 pt-4">
              <dt className="text-sm font-semibold text-navy-900">{label}</dt>
              <dd className="mt-1 text-sm text-slate-600">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Service categories mapped to common IT needs"
        description="Names only, in the same groups as the services catalogue. The scope of each one is explained on its own page."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {serviceGroups.flatMap((group) =>
            group.slugs.flatMap((slug) => {
              const service = getServiceBySlug(slug);
              if (!service) return [];
              return [
                <li
                  key={service.slug}
                  className="border-l-2 border-accent/40 pl-4 text-sm text-slate-700"
                >
                  <Link
                    href={`/services/${service.slug}`}
                    className="font-semibold text-navy-900 hover:text-accent"
                  >
                    {service.title}
                  </Link>
                  <span className="mt-1 block text-slate-600">
                    {service.cardText}
                  </span>
                </li>,
              ];
            }),
          )}
        </ul>
        <p className="mt-6 text-sm text-slate-600">
          The grouped catalogue is on the{" "}
          <Link
            href="/services"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            services
          </Link>{" "}
          page.
        </p>
      </Section>

      <Section
        tone="muted"
        title="Who bids, and who delivers"
        description="The same two-company model applies to a public-sector or prime-contractor opportunity. It is explained for the requirement in front of the buyer. No framework approval, contract history or certification is claimed here."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <article>
            <h3 className="text-xl text-navy-900">OccasionFun Ltd</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              The UK-registered company that identifies the opportunity, takes
              part in the bid and coordinates the engagement. Company number{" "}
              {company.companyNumber}.
            </p>
          </article>
          <article>
            <h3 className="text-xl text-navy-900">DGV Group</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A separate India-registered company under common ownership. DGV
              Group provides technical planning, architecture, development,
              design, testing and implementation. It is not an unrelated
              supplier and not the same legal entity as OccasionFun.
            </p>
          </article>
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-slate-600">
          Where a tender asks about delivery location, access to systems or
          data, or the role of DGV Group, that is answered for the specific
          requirement. Access from outside the UK is not assumed to be
          acceptable.           See the{" "}
          <Link
            href="/technology-partner"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            technology partner
          </Link>{" "}
          page for the responsibilities of each company.
        </p>
      </Section>

      <Section title="UK engagement">
        <p className="max-w-3xl text-base leading-relaxed text-slate-600">
          A UK business representative is physically available in the UK, and a
          UK-based IT professional forms part of the current operating setup.
          Named contact details, roles and availability will be published only
          after the company supplies and approves them.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="border-t border-slate-200 pt-4">
            <dt className="text-sm font-semibold text-navy-900">
              UK business representative
            </dt>
            <dd className="mt-1 text-sm text-slate-600">
              {displayOrPending(
                company.ukRepresentativeName,
                "Name pending approval",
              )}
              {" · "}
              {displayOrPending(
                company.ukRepresentativeRole,
                "Role pending approval",
              )}
            </dd>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <dt className="text-sm font-semibold text-navy-900">
              UK IT professional
            </dt>
            <dd className="mt-1 text-sm text-slate-600">
              {company.ukItProfessionalNote}
            </dd>
          </div>
        </dl>
      </Section>

      <Section
        tone="muted"
        title="Procurement readiness and tender-specific compliance"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <p className="text-sm leading-relaxed text-slate-600">
            We are willing to provide relevant company, insurance, financial,
            policy, technical and personnel information requested by a buyer,
            provided it exists and is accurate. Sensitive documents are shared
            through controlled channels—not published automatically on this
            website.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            Requirements vary. {company.legalName} reviews each tender&apos;s
            conditions, selection criteria, security obligations, insurance
            levels, financial thresholds, subcontracting rules and
            data-location restrictions before bidding. We do not describe
            ourselves as “fully tender compliant”, “government approved” or a
            “framework supplier” as a blanket statement.
          </p>
        </div>
      </Section>

      <CTABanner
        title="Supplier and procurement enquiries"
        description="Request supplier information or discuss a public-sector or prime-contractor opportunity."
        primaryHref="/contact?enquiryType=Public-sector%20procurement"
        primaryLabel="Request supplier information"
        secondaryHref="/policies"
        secondaryLabel="View policy library"
      />
    </>
  );
}
