import { requireAdminPageAccess } from "@/lib/auth";
import AdminAccessClient from "./AdminAccessClient";

export const metadata = {
  title: "Admin Access Management - CODE AROHA",
};

export default async function AdminAccessPage() {
  await requireAdminPageAccess();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Access Management</h1>
      <AdminAccessClient />
    </div>
  );
}
