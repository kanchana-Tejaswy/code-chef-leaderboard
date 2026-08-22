import { requireStaffReadPageAccess } from "@/lib/auth";
import { StudentDirectoryClient } from "./StudentDirectoryClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Student Directory - CODE AROHA",
  description: "View and manage student profile details.",
};

export default async function StudentDirectoryPage() {
  const access = await requireStaffReadPageAccess();
  
  return (
    <StudentDirectoryClient
      userRole={access.role}
      userDepartmentId={access.departmentId || null}
      canDelete={access.canDeleteStudents}
    />
  );
}
