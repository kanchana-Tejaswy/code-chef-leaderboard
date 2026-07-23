import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
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
      userAccess.role === UserRole.ADMIN &&
      userAccess.status === AccountStatus.ACTIVE
    ) {
      // Authenticated active Admin visiting /login -> redirect to /dashboard
      redirect("/dashboard");
    } else {
      // Authenticated non-Admin or Inactive user -> sign out to clear non-admin session
      await supabase.auth.signOut();
    }
  }

  return <LoginForm />;
}
