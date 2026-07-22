import { requireStudentProfileReadPageAccess } from "@/lib/auth";

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
