import * as fs from "fs";
import * as path from "path";

// Load .env
const envPath = path.resolve(__dirname, "../.env");
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

async function run() {
  const { prisma } = await import("file:///d:/code chef leader board ace/code-chef-leaderboard/src/lib/prisma");

  const studentCount = await prisma.studentProfile.count();
  const leaderboardCount = await prisma.leaderboardEntry.count();
  const codechefCount = await prisma.codechefProfile.count();
  const leetcodeCount = await prisma.leetcodeProfile.count();
  const githubCount = await prisma.githubProfile.count();

  console.log("=== DB DATA DIAGNOSTICS ===");
  console.log(`Student Profiles Count  : ${studentCount}`);
  console.log(`Leaderboard Entries Count: ${leaderboardCount}`);
  console.log(`CodeChef Profiles Count  : ${codechefCount}`);
  console.log(`LeetCode Profiles Count  : ${leetcodeCount}`);
  console.log(`GitHub Profiles Count    : ${githubCount}\n`);

  const targets = ["L.Joshua", "Vikas Nooka", "K.tejaswy", "Ruthwika Gone"];
  const targetStudents = await prisma.studentProfile.findMany({
    where: {
      name: { in: targets }
    },
    include: {
      leaderboardEntry: true
    }
  });
  // 

  console.log("=== KEY STUDENT VALUES ===");
  targetStudents.forEach((student) => {
    console.log(`Student: ${student.name}`);
    console.log(`  codechefScore: ${student.leaderboardEntry?.codechefScore}`);
    console.log(`  leetcodeScore: ${student.leaderboardEntry?.leetcodeScore}`);
    console.log(`  githubScore  : ${student.leaderboardEntry?.githubScore}`);
    console.log(`  overallScore : ${student.leaderboardEntry?.overallScore}`);
    console.log(`  rank         : ${student.leaderboardEntry?.rank}`);
    console.log(`  stars        : ${student.leaderboardEntry?.stars}`);
    console.log(`  updatedAt    : ${student.leaderboardEntry?.updatedAt}`);
    console.log("------------------------");
  });

  await prisma.$disconnect();
}

run().catch(console.error);
