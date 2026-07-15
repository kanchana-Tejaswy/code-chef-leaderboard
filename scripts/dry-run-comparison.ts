import * as fs from "fs";
import * as path from "path";

// Load .env
const envPath = path.resolve(__dirname, "../.env");
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

async function run() {
  const { prisma } = await import("file:///d:/code chef leader board ace/code-chef-leaderboard/src/lib/prisma");
  const { CodechefAiEngine, LeetcodeAiEngine, GithubAiEngine } = await import("file:///d:/code chef leader board ace/code-chef-leaderboard/src/services/ai-engine.service");
  const { OverallScoreService } = await import("file:///d:/code chef leader board ace/code-chef-leaderboard/src/services/overallScore.service");

  const students = await prisma.studentProfile.findMany({
    include: {
      codechefProfile: true,
      leetcodeProfile: true,
      githubProfile: true,
      leaderboardEntry: true,
      normalizedProfile: true,
    }
  });

  const comparison = [];

  for (const student of students) {
    const le = student.leaderboardEntry;
    if (!le) continue;

    // Calculate canonical CodeChef Score
    let canonicalCcScore = 0;
    const hasCc = !!student.codechefProfile && !!student.normalizedProfile;
    if (hasCc) {
      const platforms = student.normalizedProfile!.platforms as any;
      const cc = platforms?.codechef;
      if (cc && cc.username !== "N/A" && cc.rating > 0) {
        const ccAi = CodechefAiEngine.analyze({
          currentRating: cc.rating,
          highestRating: cc.highestRating,
          stars: cc.stars,
          problemsSolved: cc.problemsSolved,
          contestCount: cc.contests?.length || 0,
        });
        canonicalCcScore = ccAi.talentScore;
      }
    }

    // Calculate canonical LeetCode Score
    let canonicalLcScore = 0;
    const hasLc = !!student.leetcodeProfile && !!student.normalizedProfile;
    if (hasLc) {
      const platforms = student.normalizedProfile!.platforms as any;
      const lc = platforms?.leetcode;
      if (lc && lc.username !== "N/A" && (lc.totalSolved > 0 || lc.contestRating > 0)) {
        const lcAi = LeetcodeAiEngine.analyze({
          problemsSolved: lc.totalSolved,
          easySolved: lc.easy,
          mediumSolved: lc.medium,
          hardSolved: lc.hard,
          acceptanceRate: 52,
          contestRating: lc.contestRating,
          contestRank: lc.ranking,
          consistencyScore: student.normalizedProfile!.consistencyScore,
        });
        canonicalLcScore = lcAi.talentScore;
      }
    }

    // Calculate canonical GitHub Score
    let canonicalGhScore = 0;
    const hasGh = !!student.githubProfile;
    if (hasGh) {
      const ghProfile = student.githubProfile!;
      const repos = ghProfile.repos as any;
      const ghAi = GithubAiEngine.analyze({
        totalRepositories: ghProfile.totalRepositories,
        totalStars: ghProfile.totalStars,
        totalForks: ghProfile.totalForks,
        followers: ghProfile.followers,
        openSourceScore: ghProfile.openSourceScore,
        contributions: ghProfile.contributions,
        languages: ghProfile.languages,
        repos: repos?.list || [],
        commitTimeline: ghProfile.commitTimeline,
        repoQualityScore: ghProfile.repoQualityScore,
        developerScore: repos?.developerScore || { score: ghProfile.openSourceScore, consistency: 50, codingActivity: 50, documentation: 50 },
        careerInsights: repos?.careerInsights || { hiringReadiness: "Capable Software Builder", strongestSkills: ["Git"], weaknesses: ["No documented repositories"], recommendedLearningPath: ["Expand project portfolio"] },
        portfolio: repos?.portfolio || { web: 0, fullStack: 0, ai: 0, mobile: 0 }
      } as any);
      canonicalGhScore = ghAi.talentScore;
    }

    // Overall Score Calculation
    const active = {
      codechef: !!student.codechefProfile,
      leetcode: !!student.leetcodeProfile,
      github: !!student.githubProfile,
    };
    const canonicalOverall = OverallScoreService.calculate(
      { codechef: canonicalCcScore, leetcode: canonicalLcScore, github: canonicalGhScore },
      active
    );

    comparison.push({
      studentId: student.id,
      name: student.name,
      currentCcScore: le.codechefScore,
      canonicalCcScore,
      currentLcScore: le.leetcodeScore,
      canonicalLcScore,
      currentGhScore: le.githubScore,
      canonicalGhScore,
      currentOverall: le.overallScore,
      canonicalOverall,
      currentRank: le.rank,
      rating: student.codechefProfile?.currentRating || 0,
      talentScore: le.talentScore,
    });
  }

  // Determine ranks for canonical values
  // Order by overallScore desc, rating desc, talentScore desc, studentId asc
  comparison.sort((a, b) => {
    if (b.canonicalOverall !== a.canonicalOverall) {
      return b.canonicalOverall - a.canonicalOverall;
    }
    if (b.rating !== a.rating) {
      return b.rating - a.rating;
    }
    if (b.talentScore !== a.talentScore) {
      return b.talentScore - a.talentScore;
    }
    return a.studentId.localeCompare(b.studentId);
  });

  const sortedComparison = comparison.map((item, index) => {
    return {
      ...item,
      proposedRank: index + 1
    };
  });

  // Write Markdown Report
  let md = `# Canonical Score Repair Dry-Run Report\n\n`;
  md += `This report compares current values in the database (recalculated using incorrect linear formulas) with the canonical AI engine scores.\n\n`;
  md += `## Dry-Run Comparison Table\n\n`;
  md += `| Student | CodeChef (Curr/Can) | Diff | LeetCode (Curr/Can) | Diff | GitHub (Curr/Can) | Diff | Overall (Curr/Can) | Diff | Rank (Curr/Prop) | Status |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const item of sortedComparison) {
    const ccDiff = item.canonicalCcScore - item.currentCcScore;
    const lcDiff = item.canonicalLcScore - item.currentLcScore;
    const ghDiff = item.canonicalGhScore - item.currentGhScore;
    const overallDiff = item.canonicalOverall - item.currentOverall;
    const rankDiff = item.proposedRank - item.currentRank;

    const hasDiff = ccDiff !== 0 || lcDiff !== 0 || ghDiff !== 0 || overallDiff !== 0 || rankDiff !== 0;
    const status = hasDiff ? "**REPAIR REQUIRED**" : "NO CHANGE";

    md += `| **${item.name}** | ${item.currentCcScore} / ${item.canonicalCcScore} | ${ccDiff > 0 ? "+" + ccDiff : ccDiff} | ${item.currentLcScore} / ${item.canonicalLcScore} | ${lcDiff > 0 ? "+" + lcDiff : lcDiff} | ${item.currentGhScore} / ${item.canonicalGhScore} | ${ghDiff > 0 ? "+" + ghDiff : ghDiff} | ${item.currentOverall} / ${item.canonicalOverall} | ${overallDiff > 0 ? "+" + overallDiff : overallDiff} | ${item.currentRank} / ${item.proposedRank} | ${status} |\n`;
  }

  fs.writeFileSync("CANONICAL_SCORE_REPAIR_DRY_RUN.md", md, "utf-8");
  console.log(`DRY_RUN_MD_CREATED: CANONICAL_SCORE_REPAIR_DRY_RUN.md`);

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("Comparison dry-run script failed:", err);
  process.exit(1);
});
