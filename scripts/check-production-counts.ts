import { prisma } from "../src/lib/prisma";

async function main() {
  const totalProfiles = await prisma.studentProfile.count();

  const bothHandles = await prisma.studentProfile.count({
    where: {
      codechefUsername: { not: null, notIn: [""] },
      leetcodeUsername: { not: null, notIn: [""] }
    }
  });

  const verified = await prisma.studentProfile.count({
    where: { profileStatus: "VERIFIED" }
  });

  const incomplete = await prisma.studentProfile.count({
    where: { profileStatus: "INCOMPLETE" }
  });

  const failed = await prisma.studentProfile.count({
    where: { profileStatus: "INVALID" }
  });

  const queued = await prisma.syncJob.count({
    where: { status: "QUEUED" }
  });

  const processing = await prisma.syncJob.count({
    where: { status: "PROCESSING" }
  });

  const retryPending = await prisma.syncJob.count({
    where: { status: "RETRY_PENDING" }
  });

  const activeJobs = await prisma.syncJob.findMany({
    where: {
      status: { in: ["QUEUED", "PROCESSING", "RETRY_PENDING", "CODECHEF_VERIFIED", "LEETCODE_VERIFIED"] }
    },
    select: { studentId: true }
  });
  const activeStudentIds = activeJobs.map(j => j.studentId);

  const eligibleButNotQueued = await prisma.studentProfile.count({
    where: {
      id: { notIn: activeStudentIds },
      codechefUsername: { not: null, notIn: [""] },
      leetcodeUsername: { not: null, notIn: [""] },
      OR: [
        { profileStatus: { not: "VERIFIED" } },
        { leaderboardEligible: false },
        { dashboardEligible: false }
      ]
    }
  });

  console.log(JSON.stringify({
    totalProfiles,
    bothHandles,
    verified,
    incomplete,
    failed,
    queued,
    processing,
    retryPending,
    eligibleButNotQueued
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
