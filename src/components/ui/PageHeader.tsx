import { Container } from "./Container";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <header className="border-b border-slate-200/80 bg-role-secondary">
      <Container className="py-10 sm:py-12">
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent animate-fade-in">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-4xl text-4xl sm:text-5xl text-balance animate-fade-up">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-600 animate-fade-up [animation-delay:80ms]">
          {description}
        </p>
      </Container>
    </header>
  );
}
