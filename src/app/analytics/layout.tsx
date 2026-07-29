import { requireStaffReadPageAccess } from "@/lib/auth";

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffReadPageAccess();
  return <>{children}</>;
}
