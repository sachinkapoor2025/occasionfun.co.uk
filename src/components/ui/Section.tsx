import type { ReactNode } from "react";
import { Container } from "./Container";

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className = "",
  tone = "default",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "navy";
}) {
  const tones = {
    default: "bg-role-primary",
    muted: "bg-role-secondary",
    navy: "bg-role-emphasis text-white",
  };

  return (
    <section id={id} className={`py-10 sm:py-12 ${tones[tone]} ${className}`}>
      <Container>
        {(eyebrow || title || description) && (
          <div className={`mb-6 max-w-3xl ${tone === "navy" ? "text-white" : ""}`}>
            {eyebrow ? (
              <p
                className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] ${
                  tone === "navy" ? "text-accent-soft" : "text-accent"
                }`}
              >
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2
                className={`text-3xl sm:text-4xl text-balance ${
                  tone === "navy" ? "text-white" : "text-navy-900"
                }`}
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p
                className={`mt-4 text-base sm:text-lg leading-relaxed ${
                  tone === "navy" ? "text-slate-200" : "text-slate-600"
                }`}
              >
                {description}
              </p>
            ) : null}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
