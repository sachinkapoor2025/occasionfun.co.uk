import { Suspense } from "react";
import { ConfirmRegistrationForm } from "@/components/admin/ConfirmRegistrationForm";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Confirm your email",
  description: "Confirm the email address for an OccasionFun account.",
  path: "/admin/register/confirm",
  indexable: false,
});

export default function AdminConfirmRegistrationPage() {
  return (
    <Suspense
      fallback={
        <p className="mx-auto max-w-md px-5 py-16 text-sm text-slate-600">
          Loading confirmation…
        </p>
      }
    >
      <ConfirmRegistrationForm />
    </Suspense>
  );
}
