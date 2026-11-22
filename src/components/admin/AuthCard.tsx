import type { ReactNode } from "react";

export function AuthCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-10 sm:px-6 sm:py-16">
      <div className="rounded-lg border border-slate-200 bg-surface px-6 py-8 shadow-[var(--shadow-soft)] sm:px-8">
        <img
          src="/brand/occasionfun-logo.png"
          alt="OccasionFun Ltd"
          width={903}
          height={198}
          className="brand-lockup-logo mb-6"
        />
        <h1 className="font-display text-3xl text-balance text-navy-900">
          {title}
        </h1>
        {intro ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">{intro}</p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
