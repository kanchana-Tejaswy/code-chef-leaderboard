import { requireAdminPageAccess } from "@/lib/auth";

export default async function DepartmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageAccess();
  return <>{children}</>;
}
