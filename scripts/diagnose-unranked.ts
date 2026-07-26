import { prisma } from "../src/lib/prisma";

async function main() {
  const verified = await prisma.studentProfile.count({
    where: { profileStatus: "VERIFIED" }
  });

  const approved = await prisma.studentProfile.count({
    where: { adminApprovalStatus: "APPROVED" }
  });

  const verifiedButPending = await prisma.studentProfile.count({
    where: {
      profileStatus: "VERIFIED",
      adminApprovalStatus: "PENDING"
    }
  });

  const leaderboardEligible = await prisma.studentProfile.count({
    where: { leaderboardEligible: true }
  });

  const dashboardEligible = await prisma.studentProfile.count({
    where: { dashboardEligible: true }
  });

  const leaderboardEntries = await prisma.leaderboardEntry.count();

  const rankNull = await prisma.leaderboardEntry.count({
    where: { rank: null as any }
  });

  const rankZero = await prisma.leaderboardEntry.count({
    where: { rank: 0 }
  });

  const approvedWithoutEntry = await prisma.studentProfile.count({
    where: {
      adminApprovalStatus: "APPROVED",
      leaderboardEntry: { is: null }
    }
  });

  const approvedNotEligible = await prisma.studentProfile.count({
    where: {
      adminApprovalStatus: "APPROVED",
      leaderboardEligible: false
    }
  });

  console.log(JSON.stringify({
    verified,
    approved,
    verifiedButPending,
    leaderboardEligible,
    dashboardEligible,
    leaderboardEntries,
    rankNull,
    rankZero,
    approvedWithoutEntry,
    approvedNotEligible
  }, null, 2));

  // Also check a few examples of approved students and their ranks
  if (approved > 0) {
    const examples = await prisma.studentProfile.findMany({
        where: { adminApprovalStatus: "APPROVED" },
        take: 5,
        include: { leaderboardEntry: true }
    });
    console.log("\nExamples of Approved Students:");
    examples.forEach(e => {
        console.log(`Student: ${e.id.substring(0,8)}... | Status: ${e.profileStatus} | Eligible: ${e.leaderboardEligible} | Rank: ${e.leaderboardEntry?.rank}`);
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
