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
  const args = process.argv.slice(2);
  const studentId = args[0];

  if (!studentId) {
    console.error("Error: Please provide a studentId as an argument.");
    console.log("Usage: npx tsx scripts/sync-student.ts <studentId>");
    process.exit(1);
  }

  const { prisma } = await import("file:///d:/code chef leader board ace/code-chef-leaderboard/src/lib/prisma");
  const { SyncService } = await import("file:///d:/code chef leader board ace/code-chef-leaderboard/src/services/sync.service");

  console.log(`Starting local administrative sync for student ID: ${studentId}...`);
  const result = await SyncService.syncStudent(studentId, "ADMIN_FORCE");

  if (result.success) {
    console.log("Synchronization completed successfully!");
  } else {
    console.error("Synchronization failed:", result.error);
    process.exit(1);
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("CLI Sync failed:", err);
  process.exit(1);
});
