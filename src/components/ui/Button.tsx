import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover shadow-[0_10px_24px_-12px_rgba(15,118,110,0.7)]",
  secondary:
    "bg-navy-900 text-white hover:bg-navy-800 shadow-[0_10px_24px_-14px_rgba(11,31,51,0.65)]",
  ghost:
    "bg-transparent text-navy-900 border border-slate-200 hover:border-navy-700 hover:bg-white",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold tracking-wide transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 disabled:cursor-not-allowed";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
} & ComponentProps<"button">) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
