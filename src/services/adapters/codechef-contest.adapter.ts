import { ContestPlatformAdapter } from "./contest-platform-adapter.interface";
import { ContestDiscoveryService } from "../contest-discovery.service";
import { ContestSyncService, SyncSummary } from "../contest-sync.service";

export class CodeChefContestAdapter implements ContestPlatformAdapter {
  async discoverContests() {
    return ContestDiscoveryService.discoverCodeChefContests();
  }

  async syncContestResults(contestId: string): Promise<SyncSummary> {
    return ContestSyncService.syncCodeChefResults(contestId);
  }
}
