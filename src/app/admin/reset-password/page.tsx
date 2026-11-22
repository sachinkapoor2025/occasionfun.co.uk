import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Choose a new password",
  description: "Choose a new OccasionFun administrator password.",
  path: "/admin/reset-password",
  indexable: false,
});

export default function AdminResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <p className="mx-auto max-w-md px-5 py-16 text-sm text-slate-600">
          Loading the password form…
        </p>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
