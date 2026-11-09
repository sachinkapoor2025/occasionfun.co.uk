import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        404
      </p>
      <h1 className="mt-3 text-4xl text-navy-900">Page not found</h1>
      <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-600">
        The page you requested is not available. Use the navigation or return
        home to continue.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/">Back to home</ButtonLink>
        <ButtonLink href="/contact" variant="ghost">
          Contact us
        </ButtonLink>
      </div>
    </Container>
  );
}
