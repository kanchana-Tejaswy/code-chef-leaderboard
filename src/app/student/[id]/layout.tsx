import { requireStudentProfileReadPageAccess } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CODE AROHA | Student Profile",
  description: "Detailed programming accomplishments and student portfolio.",
};

export default async function StudentProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  await requireStudentProfileReadPageAccess(resolvedParams.id);
  return <>{children}</>;
}
