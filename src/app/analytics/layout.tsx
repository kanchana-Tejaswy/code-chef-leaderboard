import { requireAdminPageAccess } from "@/lib/auth";

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageAccess();
  return <>{children}</>;
}
