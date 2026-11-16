import Link from "next/link";
import type { ReactNode } from "react";
import { company } from "@/config/company";
import { services } from "@/content/services";
import { ButtonLink } from "./Button";

export function SupplierInfoPanel() {
  const serviceCategories = services.map((s) => s.shortTitle).join("; ");

  const rows: Array<{ label: string; value: ReactNode }> = [
    { label: "Legal supplier name", value: company.legalName },
    { label: "Company number", value: company.companyNumber },
    { label: "Registration jurisdiction", value: company.jurisdiction },
    { label: "Address", value: company.businessAddress },
    {
      label: "Registered office",
      value: "Not published on this website.",
    },
    { label: "Telephone", value: company.businessPhone },
    {
      label: "UK representative",
      value: `${company.ukRepresentativeName}, ${company.ukRepresentativeRole}`,
    },
    {
      label: "Registration and bidding enquiries",
      value: (
        <>
          <a
            href={`mailto:${company.biddingEmail}`}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            {company.biddingEmail}
          </a>
          <span className="mt-1 block">
            Registration and bidding correspondence only. General enquiries use
            the contact form. The form does not send notifications to this
            address.
          </span>
        </>
      ),
    },
    { label: "Main service categories", value: serviceCategories },
    {
      label: "Technology partner",
      value:
        "Divit Global Ventures (DGV), a technology delivery company and separate legal entity under common ownership. DGV provides IT services, software development and technical project delivery for clients under a signed agreement.",
    },
    {
      label: "Delivery arrangement",
      value:
        "OccasionFun handles UK client engagement, requirements, bidding, coordination and client communication, and supports delivery. DGV designs, develops and delivers the technology for clients.",
    },
  ];

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Supplier information
          </p>
          <h2 className="mt-2 text-2xl text-navy-900">
            Procurement-friendly company identity
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Use this panel for due diligence orientation. Request documentation
            through the enquiry form—documents are not disclosed automatically.
          </p>
        </div>
        <ButtonLink href="/contact?enquiryType=Public-sector%20procurement">
          Request supplier information
        </ButtonLink>
      </div>

      <dl className="mt-8 divide-y divide-slate-200 border-t border-slate-200">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid gap-2 py-4 sm:grid-cols-[220px_1fr] sm:gap-6"
          >
            <dt className="text-sm font-semibold text-navy-900">{row.label}</dt>
            <dd className="text-sm leading-relaxed text-slate-600">{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-sm text-slate-500">
        Related pages:{" "}
        <Link href="/public-sector" className="font-medium text-accent underline-offset-2 hover:underline">
          Public sector
        </Link>
        {" · "}
        <Link href="/policies" className="font-medium text-accent underline-offset-2 hover:underline">
          Policies
        </Link>
        {" · "}
        <Link href="/trust" className="font-medium text-accent underline-offset-2 hover:underline">
          Trust
        </Link>
      </p>
    </aside>
  );
}
