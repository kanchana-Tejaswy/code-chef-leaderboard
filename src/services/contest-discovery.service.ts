import { prisma } from "../lib/prisma";
import { ContestPlatform, ContestStatus } from "@prisma/client";

export class ContestDiscoveryService {
  /**
   * Fetches the complete contest list from CodeChef and updates the database.
   */
  static async discoverContests(): Promise<{
    discovered: number;
    upserted: number;
    errors: string[];
  }> {
    const url = "https://www.codechef.com/api/list/contests/all";
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    };

    const errors: string[] = [];
    let discovered = 0;
    let upserted = 0;

    try {
      console.log(`[Contest Discovery] Fetching contest list from CodeChef...`);
      const res = await fetch(url, { headers, next: { revalidate: 0 } });
      if (!res.ok) {
        throw new Error(`Failed to fetch contest list: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      if (!data || typeof data !== "object") {
        throw new Error("Invalid response format received from CodeChef.");
      }

      const presentList = data.present_contests || [];
      const futureList = data.future_contests || [];
      const pastList = data.past_contests || [];

      console.log(
        `[Contest Discovery] Discovered lists: ${presentList.length} present, ${futureList.length} future, ${pastList.length} past.`
      );

      const allItems: { item: any; status: ContestStatus }[] = [];

      presentList.forEach((item: any) => allItems.push({ item, status: ContestStatus.LIVE }));
      futureList.forEach((item: any) => allItems.push({ item, status: ContestStatus.UPCOMING }));
      // Bounded limit for past contests discovery (recent 25 as per Prompt guidelines)
      pastList.slice(0, 25).forEach((item: any) => allItems.push({ item, status: ContestStatus.COMPLETED }));

      discovered = allItems.length;

      for (const entry of allItems) {
        const { item, status } = entry;
        const contestCode = item.contest_code;

        if (!contestCode) {
          continue;
        }

        try {
          const startTime = new Date(item.contest_start_date_iso || item.contest_start_date);
          const endTime = new Date(item.contest_end_date_iso || item.contest_end_date);
          const durationMinutes = parseInt(item.contest_duration, 10) || null;
          const name = item.contest_name || contestCode;
          const slug = `codechef-${contestCode.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
          const contestUrl = `https://www.codechef.com/${contestCode}`;

          await prisma.contest.upsert({
            where: {
              platform_platformContestId: {
                platform: ContestPlatform.CODECHEF,
                platformContestId: contestCode,
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
              platform: ContestPlatform.CODECHEF,
              platformContestId: contestCode,
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
          console.error(`[Contest Discovery] Failed to upsert contest ${contestCode}:`, e);
          errors.push(`Contest ${contestCode} upsert failed: ${e.message}`);
        }
      }

      console.log(`[Contest Discovery] Finished. Discovered: ${discovered}, Upserted successfully: ${upserted}.`);
    } catch (err: any) {
      console.error(`[Contest Discovery] Critical error during discovery:`, err);
      errors.push(`Critical discovery failure: ${err.message}`);
    }

    return { discovered, upserted, errors };
  }
}
