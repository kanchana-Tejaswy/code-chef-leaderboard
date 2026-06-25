"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/app/providers";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If auth state is loaded, user exists, but they do not have a profile,
    // and they aren't already on the profile page, redirect them to complete setup.
    if (!isLoading && user && !profile && pathname !== "/profile") {
      router.push("/profile?setup=true");
    }
  }, [user, profile, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-[#030303]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-zinc-500 font-semibold tracking-wider uppercase">
            Verifying Session...
          </span>
        </div>
      </div>
    );
  }

  // If authenticated but no profile, block dashboard access while redirecting
  if (user && !profile && pathname !== "/profile") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-[#030303]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-zinc-500 font-semibold tracking-wider uppercase">
            Redirecting to Profile Setup...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
