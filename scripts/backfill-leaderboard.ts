import { prisma } from "../src/lib/prisma.ts";

async function main() {
  console.log("Starting backfill for missing LeaderboardEntry records...");

  const studentsWithoutLeaderboard = await prisma.studentProfile.findMany({
    where: {
      leaderboardEntry: null
    }
  });

  console.log(`Found ${studentsWithoutLeaderboard.length} students missing leaderboard entries.`);

  let createdCount = 0;
  for (const student of studentsWithoutLeaderboard) {
    try {
      await prisma.leaderboardEntry.create({
        data: {
          studentId: student.id,
          rank: 0,
          rating: 0,
          stars: 1,
          talentScore: 0,
          overallScore: 0,
          codechefScore: 0,
          leetcodeScore: 0,
          githubScore: 0,
          trendDirection: "UP"
        }
      });
      createdCount++;
      if (createdCount % 50 === 0) {
        console.log(`Created ${createdCount} entries...`);
      }
    } catch (err: any) {
      console.error(`Failed to create leaderboard entry for student ${student.id}:`, err.message);
    }
  }

  console.log(`Successfully created ${createdCount} missing leaderboard entries.`);
}

main()
  .catch((e) => {
    console.error("An error occurred during backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    console.log("Backfill completed.");
  });
