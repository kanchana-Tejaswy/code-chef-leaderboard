import { PrismaClient } from "@prisma/client";
import { OverallScoreService } from "../src/services/overallScore.service";
import { SyncService } from "../src/services/sync.service";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting score recalculation for CodeChef and LeetCode only...");

  const students = await prisma.studentProfile.findMany({
    include: {
      codechefProfile: true,
      leetcodeProfile: true,
      githubProfile: true,
      leaderboardEntry: true
    }
  });

  console.log(`Found ${students.length} students to process.`);

  let updatedCount = 0;

  for (const student of students) {
    if (!student.leaderboardEntry) {
      continue;
    }

    try {
      const active = {
        codechef: !!student.codechefProfile,
        leetcode: !!student.leetcodeProfile,
      };

      const ccScore = student.leaderboardEntry.codechefScore || 0;
      const lcScore = student.leaderboardEntry.leetcodeScore || 0;

      const newOverallScore = OverallScoreService.calculate(
        { codechef: ccScore, leetcode: lcScore },
        active
      );

      await prisma.leaderboardEntry.update({
        where: { id: student.leaderboardEntry.id },
        data: { overallScore: newOverallScore }
      });
      
      console.log(`Updated ${student.name} (${student.rollNumber}) -> New Score: ${newOverallScore}`);
      updatedCount++;
    } catch (e: any) {
      console.error(`Failed to update score for ${student.name}:`, e.message);
    }
  }

  console.log(`Recalculated scores for ${updatedCount} students.`);
  
  console.log("Re-computing ranks...");
  await SyncService.recalculateRanks();

  console.log("Completed recalculation and ranking successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
