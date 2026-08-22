import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeetCode Contests - CODE AROHA",
  description: "Official schedule and live statistics for LeetCode contests on CODE AROHA.",
};

export default function LeetCodeContestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
