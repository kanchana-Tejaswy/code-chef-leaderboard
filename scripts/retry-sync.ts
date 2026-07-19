import * as dotenv from "dotenv";
import path from "path";

// Load environment variables for the standalone script
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

process.env.NODE_ENV = "production"; // Force Prisma to use SSL for Supabase

import { prisma } from "../src/lib/prisma";
import { SyncService } from "../src/services/sync.service";

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error("❌ Please provide at least one unique identifier (roll number, email, or studentProfileId).");
    console.error("Usage: npx tsx scripts/retry-sync.ts <id_or_rollNumber_or_email> ...");
    process.exit(1);
  }

  console.log(`Looking up students by identifiers: ${args.join(", ")}...`);
  
  for (const identifier of args) {
    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { id: identifier },
          { rollNumber: identifier },
          { email: identifier }
        ]
      }
    });

    if (!student) {
      console.log(`❌ Student not found for identifier: ${identifier}`);
      continue;
    }

    console.log(`\n⏳ Retrying sync for ${student.name} (${student.rollNumber})...`);
    try {
      const result = await SyncService.syncStudent(student.id, "ADMIN_FORCE");
      if (result.success) {
        console.log(`✅ Successfully synced ${student.name}!`);
      } else {
        console.error(`❌ Sync failed for ${student.name}: ${result.error}`);
      }
    } catch (e) {
      console.error(`❌ Exception during sync for ${student.name}:`, e);
    }
  }

  // Recalculate ranks globally after fixing them
  console.log("\n📈 Recalculating leaderboard ranks globally...");
  await SyncService.recalculateLeaderboardRanks();
  console.log("✅ Ranks recalculated successfully.");
  
  console.log("\n🎉 Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
