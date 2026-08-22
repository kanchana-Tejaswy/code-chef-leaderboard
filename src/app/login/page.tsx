import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import { getRoleHomePath } from "@/lib/auth";
import LoginForm from "./LoginForm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login - CODE AROHA",
  description: "Sign in to CODE AROHA competitive programming platform.",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    let userAccess = null;
    try {
      userAccess = await prisma.userAccess.findFirst({
        where: {
          OR: [
            { authUserId: user.id },
            { email: user.email?.toLowerCase() },
          ],
        },
      });
    } catch (error) {
      console.error("[Login Page] Failed to load user access record:", error);
    }

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
