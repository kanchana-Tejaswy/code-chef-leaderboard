import { getAuthenticatedUserAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContestListingClient } from "@/components/contests/ContestListingClient";

export default async function ContestsPage() {
  const access = await getAuthenticatedUserAccess();
  if (!access || access.status !== "ACTIVE") {
    redirect("/login");
  }

  return <ContestListingClient userRole={access.role} />;
}
