import { SyncService } from "../src/services/sync.service";
import { OverallScoreService } from "../src/services/overallScore.service";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting full leaderboard rank and score backfill...");
  console.log("This will apply the corrected formula for CodeChef and LeetCode globally.");
  
  const entries = await prisma.leaderboardEntry.findMany({
    include: {
      student: {
        include: {
          codechefProfile: true,
          leetcodeProfile: true
        }
      }
    }
  });

  console.log(`Found ${entries.length} leaderboard entries to process...`);

  for (const entry of entries) {
    const student = entry.student;
    
    // We only recalculate if they actually have a profile saved.
    // If they have no profile at all, the score is 0.
    const ccScore = student.codechefProfile 
      ? OverallScoreService.calculateCodechefScore(student.codechefProfile) 
      : 0;
    
    const lcScore = student.leetcodeProfile 
      ? OverallScoreService.calculateLeetcodeScore(student.leetcodeProfile) 
      : 0;

    const active = {
      codechef: !!student.codechefProfile,
      leetcode: !!student.leetcodeProfile,
    };

    const overallScore = OverallScoreService.calculate(
      { codechef: ccScore, leetcode: lcScore },
      active
    );

    // Only update if there is a discrepancy to save DB writes
    if (
      entry.overallScore !== overallScore || 
      entry.codechefScore !== ccScore || 
      entry.leetcodeScore !== lcScore
    ) {
      await prisma.leaderboardEntry.update({
        where: { id: entry.id },
        data: {
          overallScore,
          codechefScore: ccScore,
          leetcodeScore: lcScore,
        }
      });
      console.log(`Updated scores for ${student.name} (${student.rollNumber}) -> Overall: ${overallScore}, CodeChef: ${ccScore}, LeetCode: ${lcScore}`);
    }
  }
  
  console.log("Scores recalculated. Recalculating global ranks...");
  
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
