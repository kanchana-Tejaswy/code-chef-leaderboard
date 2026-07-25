import * as path from "path";
import { loadEnvConfig } from "@next/env";

const projectDir = path.resolve(__dirname, "..");
loadEnvConfig(projectDir);

async function run() {
  const { prisma } = await import("../src/lib/prisma");

  try {
    const totalStudents = await prisma.studentProfile.count();

    const withCodeChef = await prisma.studentProfile.count({
      where: { codechefUsername: { not: null, notIn: [""] } }
    });

    const withLeetCode = await prisma.studentProfile.count({
      where: { leetcodeUsername: { not: null, notIn: [""] } }
    });

    const withBoth = await prisma.studentProfile.count({
      where: {
        AND: [
          { codechefUsername: { not: null, notIn: [""] } },
          { leetcodeUsername: { not: null, notIn: [""] } }
        ]
      }
    });

    const missingCodeChef = await prisma.studentProfile.count({
      where: {
        OR: [{ codechefUsername: null }, { codechefUsername: "" }]
      }
    });

    const missingLeetCode = await prisma.studentProfile.count({
      where: {
        OR: [{ leetcodeUsername: null }, { leetcodeUsername: "" }]
      }
    });

    const profileStatusGroups = await prisma.studentProfile.groupBy({
      by: ["profileStatus"],
      _count: { _all: true }
    });

    const countCodechefProfile = await prisma.codechefProfile.count();
    const countLeetcodeProfile = await prisma.leetcodeProfile.count();

    const countBothPlatformProfiles = await prisma.studentProfile.count({
      where: {
        codechefProfile: { isNot: null },
        leetcodeProfile: { isNot: null }
      }
    });

    const countLeaderboardEntry = await prisma.leaderboardEntry.count();

    const leaderboardEligibleCount = await prisma.studentProfile.count({
      where: { leaderboardEligible: true }
    });

    const dashboardEligibleCount = await prisma.studentProfile.count({
      where: { dashboardEligible: true }
    });

    // Number requiring sync: student profiles with both usernames but not yet VERIFIED (or without verified profiles / sync)
    const requiringSync = await prisma.studentProfile.count({
      where: {
        AND: [
          { codechefUsername: { not: null, notIn: [""] } },
          { leetcodeUsername: { not: null, notIn: [""] } },
          {
            OR: [
              { profileStatus: { not: "VERIFIED" } },
              { leaderboardEligible: false },
              { dashboardEligible: false },
              { codechefProfile: null },
              { leetcodeProfile: null }
            ]
          }
        ]
      }
    });

    console.log("=== PRODUCTION DATA DIAGNOSTIC RESULTS ===");
    console.log(`Total StudentProfile count            : ${totalStudents}`);
    console.log(`With CodeChef username               : ${withCodeChef}`);
    console.log(`With LeetCode username               : ${withLeetCode}`);
    console.log(`With both usernames                  : ${withBoth}`);
    console.log(`Missing CodeChef                     : ${missingCodeChef}`);
    console.log(`Missing LeetCode                     : ${missingLeetCode}`);
    console.log("Count grouped by profileStatus        :");
    profileStatusGroups.forEach((g) => {
      console.log(`  - ${g.profileStatus}: ${g._count._all}`);
    });
    console.log(`Count with CodechefProfile           : ${countCodechefProfile}`);
    console.log(`Count with LeetcodeProfile           : ${countLeetcodeProfile}`);
    console.log(`Count with both platform profiles    : ${countBothPlatformProfiles}`);
    console.log(`Count with LeaderboardEntry          : ${countLeaderboardEntry}`);
    console.log(`Count leaderboardEligible = true     : ${leaderboardEligibleCount}`);
    console.log(`Count dashboardEligible = true       : ${dashboardEligibleCount}`);
    console.log(`Number requiring synchronization     : ${requiringSync}`);
    console.log("==========================================");
  } catch (err: any) {
    console.error("Error inspecting database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
