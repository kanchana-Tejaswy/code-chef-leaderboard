import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import { getRoleHomePath } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const userAccess = await prisma.userAccess.findFirst({
      where: {
        OR: [
          { authUserId: user.id },
          { email: user.email?.toLowerCase() },
        ],
      },
    });

    if (
      userAccess &&
      (userAccess.role === UserRole.ADMIN || userAccess.role === UserRole.GK_SIR || userAccess.role === UserRole.HOD) &&
      userAccess.status === AccountStatus.ACTIVE
    ) {
      // Authenticated active staff visiting /login -> redirect to their home path
      redirect(getRoleHomePath(userAccess));
    } else {
      // Authenticated non-staff (e.g. STUDENT) or Inactive user -> sign out to clear session
      await supabase.auth.signOut();
    }
  }

  return <LoginForm />;
}
