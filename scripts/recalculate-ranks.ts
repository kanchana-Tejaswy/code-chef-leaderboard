import { SyncService } from "../src/services/sync.service";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting full leaderboard rank recalculation...");
  console.log("This will apply dense competitive ranking globally across all students.");
  
  await SyncService.recalculateLeaderboardRanks();
  
  console.log("Done. Verifying ranks...");
  
  const top10 = await prisma.leaderboardEntry.findMany({
    take: 10,
    orderBy: { rank: "asc" },
    include: { student: { select: { name: true, rollNumber: true } } }
  });
  
  console.table(top10.map(t => ({
    Rank: t.rank,
    Name: t.student.name,
    Overall: t.overallScore,
    CodeChef: t.codechefScore,
    LeetCode: t.leetcodeScore
  })));
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
