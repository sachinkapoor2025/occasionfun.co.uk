import Link from "next/link";
import { company, displayOrPending } from "@/config/company";
import { companyNav, footerExplore, legalNav } from "@/config/navigation";
import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-navy-950 text-slate-200">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="inline-flex rounded-md bg-white px-3 py-2">
              <span className="brand-lockup">
                <img
                  src="/brand/occasionfun-logo.png"
                  alt="OccasionFun Ltd"
                  width={903}
                  height={198}
                  className="brand-lockup-logo"
                />
                <span className="brand-tagline">UK technology services</span>
              </span>
            </Link>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              UK-registered company for technology project opportunities,
              bidding and project coordination. Technical delivery is provided
              by DGV Group, a separate India-registered company under common
              ownership.
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
              Site
            </p>
            <ul className="mt-4 space-y-2">
              {footerExplore.map((item) => (
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
              Company
            </p>
            <ul className="mt-4 space-y-2">
              {companyNav.map((item) => (
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
