import { requireAdmin } from "@/lib/auth";

export default async function DepartmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
