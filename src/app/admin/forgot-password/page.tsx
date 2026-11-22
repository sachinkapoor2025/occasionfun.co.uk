import { ForgotPasswordForm } from "@/components/admin/ForgotPasswordForm";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Reset administrator password",
  description: "Request a password reset code for OccasionFun administration.",
  path: "/admin/forgot-password",
  indexable: false,
});

export default function AdminForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
