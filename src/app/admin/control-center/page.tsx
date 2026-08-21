import { requireAdminPageAccess } from "@/lib/auth";
import AdminControlCenterClient from "./AdminControlCenterClient";

export const metadata = {
  title: "Admin Profile & Control Center - CODE AROHA",
  description: "Secure account management and system controls for CODE AROHA Platform.",
};

export default async function AdminControlCenterPage() {
  const adminAccess = await requireAdminPageAccess();

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-brand-border pb-5">
          <h1 className="text-3xl font-black tracking-tight text-brand-text">
            Admin Profile & Control Center
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            Manage application accounts, system credentials, security settings, and audit logs.
          </p>
        </div>
        <AdminControlCenterClient currentAdminId={adminAccess.id} currentAdminEmail={adminAccess.email || ""} />
      </div>
    </div>
  );
}
