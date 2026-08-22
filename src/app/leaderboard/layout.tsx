import { requireLeaderboardPageAccess } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CODE AROHA | Student Leaderboard",
  description: "Aggregated student competitive coding standings.",
};

export default async function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireLeaderboardPageAccess();
  return <>{children}</>;
}
