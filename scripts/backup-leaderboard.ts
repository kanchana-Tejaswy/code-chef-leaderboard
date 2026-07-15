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
  
  const students = await prisma.studentProfile.findMany({
    include: {
      codechefProfile: true,
      leetcodeProfile: true,
      githubProfile: true,
      leaderboardEntry: true,
      aiAnalysis: true,
    }
  });

  const backupData = students.map((student) => {
    return {
      studentProfileId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      codechefProfileId: student.codechefProfile?.id || null,
      leetcodeProfileId: student.leetcodeProfile?.id || null,
      githubProfileId: student.githubProfile?.id || null,
      codechefScore: student.leaderboardEntry?.codechefScore ?? null,
      leetcodeScore: student.leaderboardEntry?.leetcodeScore ?? null,
      githubScore: student.leaderboardEntry?.githubScore ?? null,
      overallScore: student.leaderboardEntry?.overallScore ?? null,
      rank: student.leaderboardEntry?.rank ?? null,
      stars: student.leaderboardEntry?.stars ?? null,
      talentScore: student.leaderboardEntry?.talentScore ?? null,
      updatedAt: student.leaderboardEntry?.updatedAt ? student.leaderboardEntry.updatedAt.toISOString() : null,
      aiAnalysis: student.aiAnalysis ? {
        id: student.aiAnalysis.id,
        talentScore: student.aiAnalysis.talentScore,
        consistencyScore: student.aiAnalysis.consistencyScore,
        problemSolvingScore: student.aiAnalysis.problemSolvingScore,
        competitiveProgrammingScore: student.aiAnalysis.competitiveProgrammingScore,
        contestScore: student.aiAnalysis.contestScore,
        learningScore: student.aiAnalysis.learningScore,
        growthScore: student.aiAnalysis.growthScore,
        disciplineScore: student.aiAnalysis.disciplineScore,
      } : null,
    };
  });

  const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0].replace("T", "_");
  const backupDir = path.resolve(__dirname, "../data-backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = `leaderboard-before-score-repair-${timestamp}.json`;
  const backupPath = path.join(backupDir, filename);
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf-8");

  console.log(`BACKUP_FILE_CREATED: ${backupPath}`);
  console.log(`Verifying backup by reading it back...`);
  const readBack = fs.readFileSync(backupPath, "utf-8");
  const parsed = JSON.parse(readBack);
  console.log(`Backup verified successfully! Total records: ${parsed.length}`);

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("Backup script failed:", err);
  process.exit(1);
});
