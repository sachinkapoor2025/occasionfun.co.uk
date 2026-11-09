import Link from "next/link";
import { company, displayOrPending } from "@/config/company";
import { services } from "@/content/services";
import { ButtonLink } from "./Button";

export function SupplierInfoPanel() {
  const serviceCategories = services.map((s) => s.shortTitle).join("; ");

  const rows = [
    { label: "Legal supplier name", value: company.legalName },
    { label: "Company number", value: company.companyNumber },
    { label: "Registration jurisdiction", value: company.jurisdiction },
    {
      label: "Registered office",
      value: displayOrPending(
        company.registeredOffice,
        "To be inserted after verification",
      ),
    },
    {
      label: "Primary contact",
      value: displayOrPending(
        company.businessEmail,
        "To be inserted after approval",
      ),
    },
    {
      label: "UK business representative",
      value: displayOrPending(
        company.ukRepresentativeName,
        "Details to be inserted after approval",
      ),
    },
    { label: "Main service categories", value: serviceCategories },
    {
      label: "Technology partner",
      value: `${company.dgvDisplayName} (full legal entity details to be verified)`,
    },
    {
      label: "Subcontracting",
      value:
        "Project-specific and disclosed in accordance with tender and contract terms",
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
