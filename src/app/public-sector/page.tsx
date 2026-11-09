import { CTABanner } from "@/components/ui/CTABanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { SupplierInfoPanel } from "@/components/ui/SupplierInfoPanel";
import { company, displayOrPending } from "@/config/company";
import { services } from "@/content/services";
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
        description="A concise view of how our capabilities relate to typical technology procurements."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {services.map((service) => (
            <li
              key={service.slug}
              className="border-l-2 border-accent/40 pl-4 text-sm text-slate-700"
            >
              <span className="font-semibold text-navy-900">{service.title}</span>
              <span className="block mt-1 text-slate-600">{service.summary}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        tone="muted"
        title="Delivery model and subcontracting transparency"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <article>
            <h3 className="text-xl text-navy-900">Supplier-facing company</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {company.legalName} is the contracting-facing supplier.
              Technology partner {company.dgvDisplayName} may provide
              specialist engineering delivery where disclosed and permitted.
            </p>
          </article>
          <article>
            <h3 className="text-xl text-navy-900">What we disclose</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Subcontractors, delivery locations, access to systems and data,
              and responsibilities are disclosed in line with tender and
              contract requirements. Overseas delivery or access is never
              assumed to be automatically acceptable.
            </p>
          </article>
        </div>
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
