"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function StudentProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function getProfileAndRedirect() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.profile?.id) {
            router.replace(`/student/${data.profile.id}`);
            return;
          }
        }
        router.replace("/login");
      } catch (err) {
        console.error("Failed to redirect student:", err);
        router.replace("/login");
      }
    }

    getProfileAndRedirect();
  }, [router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-brand-bg text-center px-4">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
        <p className="text-sm font-bold text-zinc-300">Loading your profile details...</p>
      </div>
    </div>
  );
}
