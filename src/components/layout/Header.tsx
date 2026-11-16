"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  companyNav,
  mainNavAfterCompany,
  mainNavBeforeCompany,
} from "@/config/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isActive(pathname: string, href: string) {
  const path = normalizePath(pathname);
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

const itemClass = (active: boolean) =>
  `rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-accent-soft text-accent"
      : "text-slate-700 hover:bg-white hover:text-navy-900"
  }`;

export function Header() {
  const pathname = usePathname();
  const companyMenuId = useId();
  const mobileCompanyId = useId();
  const companyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const companySectionActive = companyNav.some((item) =>
    isActive(pathname, item.href),
  );
  const [mobileCompanyOpen, setMobileCompanyOpen] = useState(companySectionActive);
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
    setCompanyOpen(false);
    setMobileCompanyOpen(
      companyNav.some((item) => isActive(pathname, item.href)),
    );
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!companyRef.current?.contains(event.target as Node)) {
        setCompanyOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setCompanyOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[rgba(247,249,252,0.92)] backdrop-blur-md">
      <Container className="flex items-center justify-between gap-4 py-3">
        <Link
          href="/"
          className="brand-lockup shrink-0"
          onClick={() => setOpen(false)}
        >
          <img
            src="/brand/occasionfun-logo.png"
            alt="OccasionFun Ltd"
            width={903}
            height={198}
            className="brand-lockup-logo"
          />
          <span className="brand-tagline">UK technology services</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {mainNavBeforeCompany.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="relative" ref={companyRef}>
            <button
              type="button"
              className={`${itemClass(companySectionActive)} inline-flex items-center`}
              aria-expanded={companyOpen}
              aria-controls={companyMenuId}
              onClick={() => setCompanyOpen((value) => !value)}
            >
              Company
              <span aria-hidden="true" className="ml-1 text-xs">
                {companyOpen ? "▴" : "▾"}
              </span>
            </button>
            {companyOpen ? (
              <div
                id={companyMenuId}
                className="absolute left-0 top-full z-50 mt-2 w-80 rounded-md border border-slate-200 bg-white p-2 shadow-[var(--shadow-soft)]"
              >
                <ul className="flex flex-col">
                  {companyNav.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`block rounded-md px-3 py-2.5 text-sm font-medium ${
                            active
                              ? "bg-accent-soft text-accent"
                              : "text-navy-900 hover:bg-slate-100"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          {mainNavAfterCompany.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ButtonLink href="/contact" className="px-4 py-2.5">
              Discuss a project
            </ButtonLink>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-navy-900 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </Container>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-slate-200 bg-white lg:hidden"
        >
          <Container className="flex flex-col gap-1 py-4">
            {mainNavBeforeCompany.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-3 text-sm font-medium ${
                    active ? "bg-accent-soft text-accent" : "text-navy-900 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <button
              type="button"
              className={`flex items-center justify-between rounded-md px-3 py-3 text-left text-sm font-medium ${
                companySectionActive
                  ? "bg-accent-soft text-accent"
                  : "text-navy-900 hover:bg-slate-100"
              }`}
              aria-expanded={mobileCompanyOpen}
              aria-controls={mobileCompanyId}
              onClick={() => setMobileCompanyOpen((value) => !value)}
            >
              Company
              <span aria-hidden="true">{mobileCompanyOpen ? "▴" : "▾"}</span>
            </button>
            {mobileCompanyOpen ? (
              <ul
                id={mobileCompanyId}
                className="mb-1 ml-3 flex flex-col border-l border-slate-200 pl-3"
              >
                {companyNav.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-md px-3 py-2.5 text-sm font-medium ${
                          active
                            ? "bg-accent-soft text-accent"
                            : "text-navy-900 hover:bg-slate-100"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {mainNavAfterCompany.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-3 text-sm font-medium ${
                    active ? "bg-accent-soft text-accent" : "text-navy-900 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </Container>
        </div>
      ) : null}
    </header>
  );
}
