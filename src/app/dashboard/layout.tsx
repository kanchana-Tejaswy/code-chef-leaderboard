import { requireDashboardAccess } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDashboardAccess();
  return <>{children}</>;
}
