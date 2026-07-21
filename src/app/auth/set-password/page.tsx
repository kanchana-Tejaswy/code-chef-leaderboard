import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { AccountStatus } from "@prisma/client";

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

  if (!userAccess || userAccess.status !== AccountStatus.PENDING || !userAccess.mustSetPassword) {
    // If not in a state to set password, sign out and redirect
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-10 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
        <div>
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">
            Email Verified
          </h2>
          <div className="mt-4 p-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Your email has been successfully verified.
            </p>
          </div>
          <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
            Password setup will be completed in the next phase. You may close this window.
          </p>
        </div>
      </div>
    </div>
  );
}
