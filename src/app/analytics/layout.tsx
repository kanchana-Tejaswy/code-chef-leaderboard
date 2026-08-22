import { requireStaffReadPageAccess } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CODE AROHA | Contest Analytics",
  description: "Deeper algorithmic performance trends and skill distribution datasets.",
};

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffReadPageAccess();
  return <>{children}</>;
}
