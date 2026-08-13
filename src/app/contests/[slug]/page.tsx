import { getAuthenticatedUserAccess } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { ContestDetailClient } from "@/components/contests/ContestDetailClient";
import { prisma } from "@/lib/prisma";

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const access = await getAuthenticatedUserAccess();
  if (!access || access.status !== "ACTIVE") {
    redirect("/login");
  }

  const { slug } = await params;

  const contest = await prisma.contest.findUnique({
    where: { slug },
  });

  if (!contest) {
    notFound();
  }

  return (
    <ContestDetailClient
      contestSlug={slug}
      contestName={contest.name}
      platform={contest.platform}
      platformContestId={contest.platformContestId}
      startTime={contest.startTime.toISOString()}
      endTime={contest.endTime.toISOString()}
      duration={contest.durationMinutes || 0}
      lastResultSync={contest.lastResultsSyncedAt ? contest.lastResultsSyncedAt.toISOString() : null}
      userRole={access.role}
    />
  );
}
