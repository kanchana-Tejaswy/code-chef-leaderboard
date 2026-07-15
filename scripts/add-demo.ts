import * as fs from "fs";
import * as path from "path";

// Load environment variables from both .env and .env.local
const loadEnv = (envFileName: string) => {
  const envPath = path.resolve(__dirname, "..", envFileName);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const cleanLine = line.replace(/\r/g, "").trim();
      if (!cleanLine || cleanLine.startsWith("#")) return;
      const parts = cleanLine.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        process.env[key] = val;
      }
    });
  }
};

loadEnv(".env");
loadEnv(".env.local");

async function run() {
  const { prisma } = await import("file:///d:/code chef leader board ace/code-chef-leaderboard/src/lib/prisma");

  console.log("Adding demo student data...");

  // Check if demo already exists, delete if it does to recreate fresh
  const existingDemo = await prisma.studentProfile.findUnique({
    where: { rollNumber: "DEMO001" }
  });

  if (existingDemo) {
    console.log("Demo student already exists. Deleting old record...");
    await prisma.studentProfile.delete({
      where: { id: existingDemo.id }
    });
  }

  // Create new demo student with dummy data
  const demoStudent = await prisma.studentProfile.create({
    data: {
      name: "Demo Student",
      rollNumber: "DEMO001",
      department: "CSE",
      year: 3,
      branch: "CSE",
      section: "A",
      codechefUsername: "demo_codechef",
      leetcodeUsername: "demo_leetcode",
      githubUsername: "demo_github",
      codechefProfile: {
        create: {
          username: "demo_codechef",
          currentRating: 1500,
          highestRating: 1600,
          globalRank: 5000,
          countryRank: 1000,
          stars: 3,
          problemsSolved: 200,
        }
      },
      leetcodeProfile: {
        create: {
          username: "demo_leetcode",
          contestRating: 1700,
          contestRank: 20000,
          problemsSolved: 350,
          easySolvedCount: 200,
          mediumSolvedCount: 100,
          hardSolvedCount: 50,
          acceptanceRate: 60.5
        }
      },
      githubProfile: {
        create: {
          username: "demo_github",
          totalRepositories: 15,
          totalStars: 45,
          totalForks: 10,
          openSourceScore: 85,
        }
      },
      aiAnalysis: {
        create: {
          talentScore: 75,
          consistencyScore: 80,
          problemSolvingScore: 78,
          competitiveProgrammingScore: 72,
          contestScore: 70,
          learningScore: 85,
          growthScore: 80,
          disciplineScore: 75,
          overallPotential: "Excellent",
          placementReadiness: "Ready",
          expectedRating6Months: 1800,
        }
      },
      leaderboardEntry: {
        create: {
          codechefScore: 60,
          leetcodeScore: 70,
          githubScore: 65,
          overallScore: 65, // Weighted average
          rank: 0, // Will be recalculated
          stars: 3,
        }
      }
    }
  });

  console.log(`Demo student created with ID: ${demoStudent.id}`);

  // Recalculate ranks to place the demo student correctly
  const { SyncService } = await import("file:///d:/code chef leader board ace/code-chef-leaderboard/src/services/sync.service");
  console.log("Recalculating leaderboard ranks...");
  await SyncService.recalculateLeaderboardRanks();

  console.log("Demo data added and ranks recalculated successfully!");

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("Failed to add demo data:", err);
  process.exit(1);
});
