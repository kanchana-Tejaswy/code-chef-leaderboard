import { requireAdmin } from "@/lib/auth";

export default async function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
