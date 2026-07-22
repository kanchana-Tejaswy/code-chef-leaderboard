import { requireDashboardPageAccess } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDashboardPageAccess();
  return <>{children}</>;
}
