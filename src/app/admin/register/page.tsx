import { RegisterForm } from "@/components/admin/RegisterForm";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Create an account",
  description: "Create an OccasionFun account. Administrator access is granted separately.",
  path: "/admin/register",
  indexable: false,
});

export default function AdminRegisterPage() {
  return <RegisterForm />;
}
