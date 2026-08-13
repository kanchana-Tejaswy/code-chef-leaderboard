import { ContestDiscoveryService } from "../src/services/contest-discovery.service";
import { ContestSyncService } from "../src/services/contest-sync.service";
import { prisma } from "../src/lib/prisma";
import { ContestStatus } from "@prisma/client";

async function runProdSync() {
  console.log("=== Starting Production Smoke Test & Sync Verification ===");

  // 1. Discover contests
  console.log("\n1. Running Contest Metadata Discovery...");
  const discovery = await ContestDiscoveryService.discoverContests();
  console.log(`Discovery Completed. Discovered: ${discovery.discovered}, Upserted: ${discovery.upserted}`);
  if (discovery.errors.length > 0) {
    console.warn("Discovery warnings/errors:", discovery.errors);
  }

  // 2. Fetch the most recent COMPLETED CodeChef contest from the database
  const completedContest = await prisma.contest.findFirst({
    where: {
      status: ContestStatus.COMPLETED
    },
    orderBy: {
      startTime: "desc"
    }
  });

  if (!completedContest) {
    console.warn("No completed contests found in the database. Syncing fallback contest: START110B");
    // Fallback sync logic
    try {
      const fallbackSync = await ContestSyncService.syncContestResults("START110B");
      console.log("Fallback Sync Summary:", JSON.stringify(fallbackSync));
    } catch (fallbackErr) {
      console.error("Fallback sync failed:", fallbackErr);
    }
    return;
  }

  console.log(`\n2. Found Completed Contest: ${completedContest.name} (Code: ${completedContest.platformContestId}, Slug: ${completedContest.slug})`);

  // 3. Run controlled results sync for this contest
  console.log(`\n3. Syncing Results for Contest: ${completedContest.platformContestId}...`);
  const syncStart = Date.now();
  const summary = await ContestSyncService.syncContestResults(completedContest.id);
  const syncDuration = Date.now() - syncStart;

  console.log(`\nResults Sync Completed in ${syncDuration}ms.`);
  console.log("Sync Summary Metrics:");
  console.log(`- Eligible Student Handles: ${summary.eligibleHandles}`);
  console.log(`- Matched Participants: ${summary.matchedParticipants}`);
  console.log(`- Non-participants: ${summary.nonparticipants}`);
  console.log(`- New Participations Registered: ${summary.recordsInserted}`);
  console.log(`- Updated Participations: ${summary.recordsUpdated}`);
  console.log(`- Scraper/Fetch Failures: ${summary.fetchFailures}`);

  console.log("\n=== Production Smoke Test Completed Successfully ===");
}

runProdSync()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Production Smoke Test Failed:", err);
    process.exit(1);
  });
