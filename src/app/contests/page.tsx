import { getAuthenticatedUserAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContestListingClient } from "@/components/contests/ContestListingClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CODE AROHA | Contests",
  description: "Official schedule and student participant analytics for coding contests.",
};

export default async function ContestsPage() {
  const access = await getAuthenticatedUserAccess();
  if (!access || access.status !== "ACTIVE") {
    redirect("/login");
  }

  return <ContestListingClient userRole={access.role} />;
}
