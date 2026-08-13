import { SyncSummary } from "../contest-sync.service";

export interface ContestPlatformAdapter {
  discoverContests(): Promise<{
    discovered: number;
    upserted: number;
    errors: string[];
  }>;
  syncContestResults(contestId: string): Promise<SyncSummary>;
}
