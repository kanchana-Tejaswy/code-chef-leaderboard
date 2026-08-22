import { requireStaffReadPageAccess } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CODE AROHA | AI Talent Insights",
  description: "Advanced analytics, career mapping, and skill projections.",
};

export default async function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffReadPageAccess();
  return <>{children}</>;
}
