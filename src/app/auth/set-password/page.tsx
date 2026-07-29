import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { AccountStatus, UserRole } from "@prisma/client";
import SetPasswordForm from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userAccess = await prisma.userAccess.findUnique({
    where: { authUserId: user.id },
  });

  if (!userAccess || userAccess.status !== AccountStatus.PENDING || !userAccess.mustSetPassword || userAccess.role !== UserRole.GK_SIR) {
    // If not in a state to set password, sign out and redirect
    await supabase.auth.signOut();
    redirect("/login");
  }

  return <SetPasswordForm />;
}
