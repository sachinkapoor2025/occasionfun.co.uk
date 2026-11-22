import { AdminGate } from "@/components/admin/AdminGate";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Administration",
  description: "OccasionFun administration.",
  path: "/admin",
  indexable: false,
});

export default function AdminPage() {
  return <AdminGate />;
}
