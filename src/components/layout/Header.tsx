"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { company } from "@/config/company";
import { mainNav } from "@/config/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[rgba(247,249,252,0.92)] backdrop-blur-md">
      <Container className="flex items-center justify-between gap-4 py-3">
        <Link
          href="/"
          className="group flex min-w-0 flex-col"
          onClick={() => setOpen(false)}
        >
          <span className="truncate text-sm font-bold tracking-[0.08em] text-navy-900 sm:text-base">
            {company.legalName}
          </span>
          <span className="hidden text-[11px] text-slate-500 sm:block">
            UK technology services
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 xl:flex"
        >
          {mainNav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-slate-700 hover:bg-white hover:text-navy-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink
            href="/contact"
            className="hidden px-4 py-2.5 sm:inline-flex"
          >
            Discuss a requirement
          </ButtonLink>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-navy-900 xl:hidden"
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
          className="border-t border-slate-200 bg-white xl:hidden"
        >
          <Container className="flex flex-col gap-1 py-4">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-3 text-sm font-medium text-navy-900 hover:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <ButtonLink href="/contact" className="mt-2" onClick={() => setOpen(false)}>
              Discuss a requirement
            </ButtonLink>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
