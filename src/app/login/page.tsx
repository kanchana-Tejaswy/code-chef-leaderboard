import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

function getRoleRedirect(role: UserRole, studentProfileId?: string | null): string {
  switch (role) {
    case UserRole.ADMIN:
      return "/dashboard";
    case UserRole.GK_SIR:
    case UserRole.HOD:
      return "/leaderboard";
    case UserRole.STUDENT:
      return studentProfileId ? `/student/${studentProfileId}` : "/login";
    default:
      return "/login";
  }
}

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const userAccess = await prisma.userAccess.findUnique({
      where: { authUserId: user.id },
    });

    if (userAccess) {
      if (
        userAccess.status === AccountStatus.ACTIVE &&
        !userAccess.mustSetPassword &&
        userAccess.firstLoginCompleted
      ) {
        // ACTIVE authenticated user
        redirect(getRoleRedirect(userAccess.role, userAccess.studentProfileId));
      } else if (
        userAccess.status === AccountStatus.PENDING &&
        userAccess.mustSetPassword &&
        !userAccess.firstLoginCompleted
      ) {
        // PENDING OTP-verified user
        redirect("/auth/set-password");
      } else {
        // Session does not match valid state
        await supabase.auth.signOut();
      }
    } else {
      // Session does not match UserAccess
      await supabase.auth.signOut();
    }
  }

  return <LoginForm />;
}
