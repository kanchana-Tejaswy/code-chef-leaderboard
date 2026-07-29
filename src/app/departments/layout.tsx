import { requireStaffReadPageAccess } from "@/lib/auth";

export default async function DepartmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffReadPageAccess();
  return <>{children}</>;
}
