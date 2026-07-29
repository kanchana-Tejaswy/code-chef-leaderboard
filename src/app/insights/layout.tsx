import { requireStaffReadPageAccess } from "@/lib/auth";

export default async function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffReadPageAccess();
  return <>{children}</>;
}
