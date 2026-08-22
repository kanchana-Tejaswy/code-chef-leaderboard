import { getAuthenticatedUserAccess } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { ContestDetailClient } from "@/components/contests/ContestDetailClient";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const contest = await prisma.contest.findUnique({
    where: { slug },
  });
  return {
    title: contest ? `${contest.name} - CODE AROHA` : "Contest Details - CODE AROHA",
    description: contest ? `Participant performance standings for ${contest.name}.` : "Contest standings details.",
  };
}

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
