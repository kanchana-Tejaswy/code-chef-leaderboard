import { requireStaffReadPageAccess } from "@/lib/auth";
import { StudentDirectoryClient } from "./StudentDirectoryClient";

export const dynamic = "force-dynamic";

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
