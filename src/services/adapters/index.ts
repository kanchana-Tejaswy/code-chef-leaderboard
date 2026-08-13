import { ContestPlatform } from "@prisma/client";
import { ContestPlatformAdapter } from "./contest-platform-adapter.interface";
import { CodeChefContestAdapter } from "./codechef-contest.adapter";
import { LeetCodeContestAdapter } from "./leetcode-contest.adapter";
import { CodeforcesContestAdapter } from "./codeforces-contest.adapter";

export * from "./contest-platform-adapter.interface";
export * from "./codechef-contest.adapter";
export * from "./leetcode-contest.adapter";
export * from "./codeforces-contest.adapter";

export function getAdapterForPlatform(platform: ContestPlatform): ContestPlatformAdapter {
  switch (platform) {
    case ContestPlatform.CODECHEF:
      return new CodeChefContestAdapter();
    case ContestPlatform.LEETCODE:
      return new LeetCodeContestAdapter();
    case ContestPlatform.CODEFORCES:
      return new CodeforcesContestAdapter();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
