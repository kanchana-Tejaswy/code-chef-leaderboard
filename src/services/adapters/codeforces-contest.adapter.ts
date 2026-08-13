import { prisma } from "../../lib/prisma";
import { ContestPlatform, ContestStatus } from "@prisma/client";
import { ContestPlatformAdapter } from "./contest-platform-adapter.interface";
import { SyncSummary } from "../contest-sync.service";

export class CodeforcesContestAdapter implements ContestPlatformAdapter {
  /**
   * Discovers contests using public Codeforces contest API.
   */
  async discoverContests(): Promise<{
    discovered: number;
    upserted: number;
    errors: string[];
  }> {
    const url = "https://codeforces.com/api/contest.list?gym=false";
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    const errors: string[] = [];
    let discovered = 0;
    let upserted = 0;

    try {
      console.log(`[Codeforces Discovery] Fetching contest list from Codeforces API...`);
      const res = await fetch(url, { headers, next: { revalidate: 0 } });
      if (!res.ok) {
        throw new Error(`Failed to fetch contest list: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      if (data.status !== "OK" || !Array.isArray(data.result)) {
        throw new Error("Invalid response format received from Codeforces API.");
      }

      const list = data.result;

      // Filter: all upcoming/live, and only the most recent 15 completed contests
      const upcomingLive = list.filter((item: any) => item.phase === "BEFORE" || item.phase === "CODING");
      const completed = list
        .filter((item: any) => item.phase === "FINISHED")
        .sort((a: any, b: any) => b.startTimeSeconds - a.startTimeSeconds)
        .slice(0, 15);

      const allItems = [...upcomingLive, ...completed];
      discovered = allItems.length;

      for (const item of allItems) {
        try {
          const startTimeSeconds = parseInt(item.startTimeSeconds, 10);
          const durationSeconds = parseInt(item.durationSeconds, 10);
          if (isNaN(startTimeSeconds) || isNaN(durationSeconds)) {
            continue;
          }

          const startTime = new Date(startTimeSeconds * 1000);
          const endTime = new Date((startTimeSeconds + durationSeconds) * 1000);
          const durationMinutes = Math.round(durationSeconds / 60);
          const name = item.name;
          const slug = `codeforces-${item.id}`;
          const contestUrl = `https://codeforces.com/contest/${item.id}`;

          let status: ContestStatus = ContestStatus.UPCOMING;
          if (item.phase === "BEFORE") {
            status = ContestStatus.UPCOMING;
          } else if (item.phase === "CODING") {
            status = ContestStatus.LIVE;
          } else if (item.phase === "FINISHED") {
            status = ContestStatus.COMPLETED;
          }

          await prisma.contest.upsert({
            where: {
              platform_platformContestId: {
                platform: ContestPlatform.CODEFORCES,
                platformContestId: `${item.id}`,
              },
            },
            update: {
              name,
              startTime,
              endTime,
              durationMinutes,
              status,
              lastMetadataSyncedAt: new Date(),
            },
            create: {
              platform: ContestPlatform.CODEFORCES,
              platformContestId: `${item.id}`,
              name,
              slug,
              contestUrl,
              startTime,
              endTime,
              durationMinutes,
              status,
              lastMetadataSyncedAt: new Date(),
            },
          });

          upserted++;
        } catch (e: any) {
          console.error(`[Codeforces Discovery] Failed to upsert contest ${item.id}:`, e);
          errors.push(`Contest ${item.id} upsert failed: ${e.message}`);
        }
      }

      console.log(`[Codeforces Discovery] Completed. Discovered: ${discovered}, Upserted: ${upserted}`);
    } catch (err: any) {
      console.error(`[Codeforces Discovery] Critical failure during discovery:`, err);
      errors.push(`Critical Codeforces discovery failure: ${err.message}`);
    }

    return { discovered, upserted, errors };
  }

  /**
   * Codeforces result synchronization is currently disabled.
   */
  async syncContestResults(contestId: string): Promise<SyncSummary> {
    throw new Error(
      `Contest results synchronization for Codeforces is currently disabled as student Codeforces handles are not verified.`
    );
  }
}
