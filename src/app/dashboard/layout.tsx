import { requireDashboardPageAccess } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CODE AROHA | Dashboard",
  description: "Real-time student coding metrics and administrative controls.",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDashboardPageAccess();
  return <>{children}</>;
}
