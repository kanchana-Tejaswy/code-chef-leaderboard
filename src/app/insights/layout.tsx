import { requireAdminPageAccess } from "@/lib/auth";

export default async function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageAccess();
  return <>{children}</>;
}
