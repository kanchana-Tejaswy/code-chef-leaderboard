import { prisma } from "../src/lib/prisma";
import { SyncService } from "../src/services/sync.service";

async function main() {
  console.log("Starting CodeChef Backfill Script...");

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx scripts/backfill-codechef.ts <rollNumber|studentId>");
    process.exit(1);
  }

  const identifier = args[0];
  let student = await prisma.studentProfile.findFirst({
    where: { rollNumber: identifier }
  });

  if (!student) {
    student = await prisma.studentProfile.findFirst({
      where: { id: identifier }
    });
  }

  if (!student) {
    console.error(`FAILED: Student not found for identifier: ${identifier}`);
    process.exit(1);
  }

  if (!student.codechefUsername) {
    console.error(`FAILED: Student ${student.name} (${student.rollNumber}) does not have a CodeChef username configured.`);
    process.exit(1);
  }

  console.log(`Found student: ${student.name} (${student.rollNumber}) - CodeChef: ${student.codechefUsername}`);
  console.log(`Initiating synchronization...`);

  try {
    const result = await SyncService.syncStudent(student.id, "SYSTEM_CRON");
    
    if (result.success) {
      console.log(`SUCCESS: CodeChef profile for ${student.rollNumber} has been synchronized and competitive scores recalculated.`);
    } else {
      console.error(`FAILED: Synchronization failed for ${student.rollNumber}:`, result.error);
    }
  } catch (error) {
    console.error(`FAILED: Unexpected error during sync for ${student.rollNumber}:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
