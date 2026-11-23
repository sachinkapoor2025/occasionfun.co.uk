"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

function isAdminPanel(pathname: string) {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return path === "/admin";
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  if (isAdminPanel(pathname)) return children;

  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
