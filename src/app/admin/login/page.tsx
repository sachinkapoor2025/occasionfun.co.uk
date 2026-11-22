import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Administrator sign-in",
  description: "Sign in to OccasionFun administration.",
  path: "/admin/login",
  indexable: false,
});

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <p className="mx-auto max-w-md px-5 py-16 text-sm text-slate-600">
          Loading sign-in…
        </p>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
