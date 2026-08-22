import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CodeChef Contests - CODE AROHA",
  description: "Official schedule and live statistics for CodeChef contests on CODE AROHA.",
};

export default function CodeChefContestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
