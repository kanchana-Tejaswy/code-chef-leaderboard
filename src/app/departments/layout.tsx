import { requireStaffReadPageAccess } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CODE AROHA | Departments",
  description: "Comparative stand standings across engineering departments.",
};

export default async function DepartmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffReadPageAccess();
  return <>{children}</>;
}
