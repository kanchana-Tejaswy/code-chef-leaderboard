import { requireStaffReadPageAccess } from "@/lib/auth";
import AcademicRegistryClient from "./AcademicRegistryClient";

export const metadata = {
  title: "Academic Registry Management - ACE Talent Intelligence",
  description: "Configure and manage cohorts, departments, and class sections.",
};

export default async function AcademicRegistryPage() {
  const userAccess = await requireStaffReadPageAccess();

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-brand-border pb-5">
          <h1 className="text-3xl font-black tracking-tight text-brand-text">
            Academic Registry Management
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            Configure institutional cohorts, departments, and academic class sections.
          </p>
        </div>
        <AcademicRegistryClient userRole={userAccess.role} userDeptId={userAccess.departmentId} />
      </div>
    </div>
  );
}
