import { requireLeaderboardAccess } from "@/lib/auth";

export default async function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireLeaderboardAccess();
  return <>{children}</>;
}
