import { requireLeaderboardPageAccess } from "@/lib/auth";

export default async function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireLeaderboardPageAccess();
  return <>{children}</>;
}
