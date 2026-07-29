import { requirePageRole } from "@/lib/auth";
import AdminControlCenterClient from "../control-center/AdminControlCenterClient";
import { UserRole } from "@prisma/client";

export const metadata = {
  title: "Profile & Control Center - ACE Talent Intelligence",
  description: "Account management and profile details.",
};

export default async function AdminProfilePage() {
  const access = await requirePageRole(UserRole.ADMIN, UserRole.GK_SIR);
  const isGkSir = access.role === UserRole.GK_SIR;

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-brand-border pb-5">
          <h1 className="text-3xl font-black tracking-tight text-brand-text">
            {isGkSir ? "My Profile" : "Admin Profile & Control Center"}
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            {isGkSir 
              ? "View and update your profile details." 
              : "Manage application accounts, system credentials, security settings, and audit logs."}
          </p>
        </div>
        <AdminControlCenterClient 
          currentAdminId={access.id} 
          currentAdminEmail={access.email} 
          role={access.role}
        />
      </div>
    </div>
  );
}
