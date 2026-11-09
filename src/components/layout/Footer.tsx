import Link from "next/link";
import { company, displayOrPending } from "@/config/company";
import { footerNav, legalNav } from "@/config/navigation";
import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-navy-950 text-slate-200">
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-lg font-semibold tracking-wide text-white">
              {company.legalName}
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              UK-registered technology services company. Specialist engineering
              delivery may be supported by technology partner {company.dgvDisplayName}{" "}
              where appropriate and permitted.
            </p>
            <dl className="mt-6 space-y-2 text-sm">
              <div>
                <dt className="inline font-semibold text-white">Company number: </dt>
                <dd className="inline">{company.companyNumber}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-white">Registered office: </dt>
                <dd className="inline">
                  {displayOrPending(
                    company.registeredOffice,
                    "Pending verification",
                  )}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold text-white">Email: </dt>
                <dd className="inline">
                  {displayOrPending(
                    company.businessEmail,
                    "Pending approval",
                  )}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold text-white">Telephone: </dt>
                <dd className="inline">
                  {displayOrPending(
                    company.businessPhone,
                    "Pending approval",
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white">
              Explore
            </p>
            <ul className="mt-4 space-y-2">
              {footerNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-slate-300 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white">
              Legal
            </p>
            <ul className="mt-4 space-y-2">
              {legalNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-slate-300 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {company.copyrightYear} {company.copyrightName}. All rights
            reserved.
          </p>
          <p>
            Jurisdiction: {company.jurisdiction}. Content is general information
            and does not replace contract-specific documentation.
          </p>
        </div>
      </Container>
    </footer>
  );
}
