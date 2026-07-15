import * as fs from "fs";
import * as path from "path";

// Load .env variables before importing prisma
const loadEnv = (envFileName: string) => {
  const envPath = path.resolve(__dirname, "..", envFileName);
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
};

loadEnv(".env");
loadEnv(".env.local");

const DEPT_MAP: Record<string, string> = {
  "CSE": "CSE", "CS": "CSE", "COMPUTER SCIENCE": "CSE",
  "IT": "IT", "INFORMATION TECHNOLOGY": "IT",
  "CSM": "CSM", "CSD": "CSD",
  "ECE": "ECE", "ELECTRONICS": "ECE",
  "EEE": "EEE", "ELECTRICAL": "EEE",
  "ME": "ME", "MECHANICAL": "ME",
  "CE": "CE", "CIVIL": "CE"
};

const normalizeDept = (dept: string | null | undefined): string | null => {
  if (!dept) return null;
  const clean = dept.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return DEPT_MAP[clean] || dept.trim().toUpperCase();
};

interface DiagnosticIssue {
  type: string;
  recordId: string;
  field: string;
  currentValue: any;
  proposedValue: any;
  reason: string;
  risk: string;
  recommendation: "APPLY" | "REVIEW" | "SKIP";
}

async function run() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const rollbackIndex = args.indexOf("--rollback");
  const isRollback = rollbackIndex !== -1;
  const rollbackFilePath = isRollback ? args[rollbackIndex + 1] : null;

  // Dynamically import prisma first
  const { prisma } = await import("../src/lib/prisma");

  if (isRollback) {
    if (!rollbackFilePath) {
      console.error("Error: --rollback requires a file path argument.");
      process.exit(1);
    }
    console.log(`=== RUNNING ROLLBACK ===`);
    console.log(`Rollback File: ${rollbackFilePath}`);

    const absoluteBackupPath = path.resolve(rollbackFilePath);
    if (!fs.existsSync(absoluteBackupPath)) {
      console.error(`Error: Backup file not found at ${absoluteBackupPath}`);
      process.exit(1);
    }

    const backupData = JSON.parse(fs.readFileSync(absoluteBackupPath, "utf-8"));
    console.log(`Loaded ${backupData.length} records from backup. Restoring...`);

    await prisma.$transaction(
      backupData.map((record: any) => {
        return prisma.leaderboardEntry.update({
          where: { studentId: record.studentProfileId },
          data: {
            codechefScore: record.codechefScore ?? 0,
            leetcodeScore: record.leetcodeScore ?? 0,
            githubScore: record.githubScore ?? 0,
            overallScore: record.overallScore ?? 0,
            rank: record.rank ?? 0,
            stars: record.stars ?? 1,
            talentScore: record.talentScore ?? 0,
          }
        });
      })
    );

    console.log("Rollback completed successfully! Leaderboard entries restored to backup state.");
    await prisma.$disconnect();
    return;
  }

  console.log(`=== ACE DATA CLEANING & CANONICAL SCORE REPAIR ===`);
  console.log(`Mode: ${isApply ? "APPLY CORRECTIONS" : "DRY RUN (DIAGNOSIS)"}\n`);

  // Dynamically import canonical logic to avoid formula duplication
  const { CodechefAiEngine, LeetcodeAiEngine, GithubAiEngine } = await import("../src/services/ai-engine.service");
  const { OverallScoreService } = await import("../src/services/overallScore.service");

  const issues: DiagnosticIssue[] = [];

  // Load data
  const students = await prisma.studentProfile.findMany({
    include: {
      codechefProfile: true,
      leetcodeProfile: true,
      githubProfile: true,
      leaderboardEntry: true,
      normalizedProfile: true,
    }
  });

  const leaderboardEntries = await prisma.leaderboardEntry.findMany({
    include: { student: true }
  });

  // Check 1: Duplicate Roll Numbers
  const rollNumbers = new Map<string, string[]>();
  students.forEach((s) => {
    if (s.rollNumber) {
      const cleanRoll = s.rollNumber.trim().toUpperCase();
      if (!rollNumbers.has(cleanRoll)) {
        rollNumbers.set(cleanRoll, []);
      }
      rollNumbers.get(cleanRoll)!.push(s.id);
    }
  });
  for (const [roll, ids] of rollNumbers.entries()) {
    if (ids.length > 1) {
      issues.push({
        type: "DUPLICATE_ROLL_NUMBER",
        recordId: ids.join(", "),
        field: "rollNumber",
        currentValue: roll,
        proposedValue: "Merge records manually",
        reason: `Duplicate roll number ${roll} found across ${ids.length} students.`,
        risk: "High - Requires human selection of primary record",
        recommendation: "REVIEW"
      });
    }
  }

  // Check 2: Duplicate Platform Handles
  const checkDuplicateHandle = (platform: "codechef" | "leetcode" | "github") => {
    const handles = new Map<string, string[]>();
    const field = platform === "codechef" ? "codechefUsername" : platform === "leetcode" ? "leetcodeUsername" : "githubUsername";
    students.forEach((s) => {
      const handle = s[field];
      if (handle) {
        const cleanHandle = handle.trim().toLowerCase();
        if (!handles.has(cleanHandle)) {
          handles.set(cleanHandle, []);
        }
        handles.get(cleanHandle)!.push(s.id);
      }
    });
    for (const [handle, ids] of handles.entries()) {
      if (ids.length > 1) {
        issues.push({
          type: `DUPLICATE_${platform.toUpperCase()}_HANDLE`,
          recordId: ids.join(", "),
          field: field,
          currentValue: handle,
          proposedValue: "Remove duplicate from incorrect student",
          reason: `Duplicate ${platform} handle '${handle}' found across ${ids.length} students.`,
          risk: "Medium",
          recommendation: "REVIEW"
        });
      }
    }
  };
  checkDuplicateHandle("codechef");
  checkDuplicateHandle("leetcode");
  checkDuplicateHandle("github");

  // Check 3: StudentProfile formatting
  students.forEach((s) => {
    if (s.name.trim() !== s.name) {
      issues.push({
        type: "WHITESPACE_IN_NAME",
        recordId: s.id,
        field: "name",
        currentValue: `'${s.name}'`,
        proposedValue: `'${s.name.trim()}'`,
        reason: "Leading/trailing whitespace in student name",
        risk: "None",
        recommendation: "APPLY"
      });
    }

    if (s.rollNumber && s.rollNumber.trim() !== s.rollNumber) {
      issues.push({
        type: "WHITESPACE_IN_ROLL_NUMBER",
        recordId: s.id,
        field: "rollNumber",
        currentValue: `'${s.rollNumber}'`,
        proposedValue: `'${s.rollNumber.trim().toUpperCase()}'`,
        reason: "Whitespace or incorrect casing in roll number",
        risk: "None",
        recommendation: "APPLY"
      });
    }

    ([
      "codechefUsername",
      "leetcodeUsername",
      "githubUsername"
    ] as const).forEach((field) => {
      const val = s[field];
      if (val && (val.trim() !== val)) {
        const platform = field.replace("Username", "").toUpperCase();
        issues.push({
          type: `WHITESPACE_IN_${platform}_USERNAME`,
          recordId: s.id,
          field,
          currentValue: `'${val}'`,
          proposedValue: `'${val.trim()}'`,
          reason: `Whitespace in ${platform} username`,
          risk: "None",
          recommendation: "APPLY"
        });
      }
    });

    if (s.department) {
      const norm = normalizeDept(s.department);
      if (norm !== s.department) {
        issues.push({
          type: "INCONSISTENT_DEPARTMENT",
          recordId: s.id,
          field: "department",
          currentValue: s.department,
          proposedValue: norm,
          reason: `Department alias '${s.department}' does not match standard CSE/IT/CSM/CSD/ECE/EEE/ME/CE`,
          risk: "Low",
          recommendation: "APPLY"
        });
      }
    }

    if (s.section && s.section.trim().toUpperCase() !== s.section) {
      issues.push({
        type: "INCONSISTENT_SECTION",
        recordId: s.id,
        field: "section",
        currentValue: s.section,
        proposedValue: s.section.trim().toUpperCase(),
        reason: "Section has lowercase or whitespace",
        risk: "Low",
        recommendation: "APPLY"
      });
    }
  });

  // Check 4: Stars mismatch using safe null fallback (?? 0)
  students.forEach((s) => {
    if (s.leaderboardEntry) {
      const le = s.leaderboardEntry;
      const ccStars = s.codechefProfile?.stars ?? 0; // Canonical fallback (0 if not linked)

      if (le.stars !== ccStars) {
        issues.push({
          type: "LEADERBOARD_STARS_MISMATCH",
          recordId: s.id,
          field: "stars",
          currentValue: le.stars,
          proposedValue: ccStars,
          reason: `Leaderboard stars cache (${le.stars}) mismatch with CodeChef Profile (${ccStars})`,
          risk: "Low",
          recommendation: "APPLY"
        });
      }
    }
  });

  // Missing Leaderboard Entries
  students.forEach((s) => {
    if (!s.leaderboardEntry) {
      issues.push({
        type: "MISSING_LEADERBOARD_ENTRY",
        recordId: s.id,
        field: "leaderboardEntry",
        currentValue: "None",
        proposedValue: "Create LeaderboardEntry",
        reason: `Student ${s.name} has usernames but no leaderboard entry cache`,
        risk: "Low",
        recommendation: "APPLY"
      });
    }
  });

  // Orphaned Leaderboard Entries
  leaderboardEntries.forEach((le) => {
    if (!le.student) {
      issues.push({
        type: "ORPHANED_LEADERBOARD_ENTRY",
        recordId: le.id,
        field: "studentId",
        currentValue: le.studentId,
        proposedValue: "Delete",
        reason: `LeaderboardEntry has StudentId ${le.studentId} which does not exist in student_profiles`,
        risk: "Low",
        recommendation: "APPLY"
      });
    }
  });

  if (!isApply) {
    console.log(`Diagnostics complete! Found ${issues.length} issue(s).`);
    console.log(`Writing dry-run results to DATA_CLEANING_DRY_RUN.md...`);
    const dryRunContent = generateDryRunMarkdown(issues);
    fs.writeFileSync("DATA_CLEANING_DRY_RUN.md", dryRunContent);
    await prisma.$disconnect();
    return;
  }

  // --- EXECUTE PHASE ---
  console.log(`Creating database backup snapshot before applying modifications...`);
  const backupData = students.map((student) => {
    return {
      studentProfileId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      codechefProfileId: student.codechefProfile?.id || null,
      leetcodeProfileId: student.leetcodeProfile?.id || null,
      githubProfileId: student.githubProfile?.id || null,
      codechefScore: student.leaderboardEntry?.codechefScore ?? null,
      leetcodeScore: student.leaderboardEntry?.leetcodeScore ?? null,
      githubScore: student.leaderboardEntry?.githubScore ?? null,
      overallScore: student.leaderboardEntry?.overallScore ?? null,
      rank: student.leaderboardEntry?.rank ?? null,
      stars: student.leaderboardEntry?.stars ?? null,
      talentScore: student.leaderboardEntry?.talentScore ?? null,
      updatedAt: student.leaderboardEntry?.updatedAt ? student.leaderboardEntry.updatedAt.toISOString() : null,
      aiAnalysis: student.aiAnalysis ? {
        id: student.aiAnalysis.id,
        talentScore: student.aiAnalysis.talentScore,
      } : null,
    };
  });

  const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0].replace("T", "_");
  const backupDir = path.resolve(__dirname, "../data-backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFilename = `leaderboard-before-score-repair-${timestamp}.json`;
  const backupPath = path.join(backupDir, backupFilename);
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf-8");
  console.log(`Backup saved to: ${backupPath}\n`);

  console.log(`Applying formatting and metadata corrections...`);
  let appliedCount = 0;

  // We perform ALL modifications, calculations, and rank rebuilds inside one transaction block
  await prisma.$transaction(async (tx) => {
    // 1. Apply format normalizations and stars fixes
    for (const issue of issues) {
      if (issue.recommendation !== "APPLY") continue;

      if (issue.type === "WHITESPACE_IN_NAME") {
        await tx.studentProfile.update({
          where: { id: issue.recordId },
          data: { name: String(issue.proposedValue).replace(/'/g, "") }
        });
        appliedCount++;
      }
      else if (issue.type === "WHITESPACE_IN_ROLL_NUMBER") {
        await tx.studentProfile.update({
          where: { id: issue.recordId },
          data: { rollNumber: String(issue.proposedValue).replace(/'/g, "") }
        });
        appliedCount++;
      }
      else if (issue.type.startsWith("WHITESPACE_IN_") && issue.type.endsWith("_USERNAME")) {
        const platformField = issue.field;
        await tx.studentProfile.update({
          where: { id: issue.recordId },
          data: { [platformField]: String(issue.proposedValue).replace(/'/g, "") }
        });
        appliedCount++;
      }
      else if (issue.type === "INCONSISTENT_DEPARTMENT") {
        await tx.studentProfile.update({
          where: { id: issue.recordId },
          data: { department: String(issue.proposedValue) }
        });
        appliedCount++;
      }
      else if (issue.type === "INCONSISTENT_SECTION") {
        await tx.studentProfile.update({
          where: { id: issue.recordId },
          data: { section: String(issue.proposedValue) }
        });
        appliedCount++;
      }
      else if (issue.type === "LEADERBOARD_STARS_MISMATCH") {
        await tx.leaderboardEntry.update({
          where: { studentId: issue.recordId },
          data: { stars: Number(issue.proposedValue) }
        });
        appliedCount++;
      }
      else if (issue.type === "ORPHANED_LEADERBOARD_ENTRY") {
        await tx.leaderboardEntry.delete({
          where: { id: issue.recordId }
        });
        appliedCount++;
      }
      else if (issue.type === "MISSING_LEADERBOARD_ENTRY") {
        await tx.leaderboardEntry.create({
          data: {
            studentId: issue.recordId,
            rating: 0,
            stars: 0,
            overallScore: 0,
            codechefScore: 0,
            leetcodeScore: 0,
            githubScore: 0,
            rank: 0,
          }
        });
        appliedCount++;
      }
    }

    console.log(`Applied ${appliedCount} formatting corrections in transaction.`);

    // 2. Recompute canonical platform scores and overall scores for all students
    console.log("Recomputing and updating leaderboard scores dynamically via canonical AI Engine formulas...");
    
    // Query freshly within transaction block
    const allStudents = await tx.studentProfile.findMany({
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        leaderboardEntry: true,
        normalizedProfile: true,
      }
    });

    for (const student of allStudents) {
      const le = student.leaderboardEntry;
      if (!le) continue;

      // Canonical CodeChef score
      let ccScore = 0;
      if (student.codechefProfile && student.normalizedProfile) {
        const platforms = student.normalizedProfile.platforms as any;
        const cc = platforms?.codechef;
        if (cc && cc.username !== "N/A" && cc.rating > 0) {
          const ccAi = CodechefAiEngine.analyze({
            currentRating: cc.rating,
            highestRating: cc.highestRating,
            stars: cc.stars,
            problemsSolved: cc.problemsSolved,
            contestCount: cc.contests?.length || 0,
          });
          ccScore = ccAi.talentScore;
        }
      }

      // Canonical LeetCode score
      let lcScore = 0;
      if (student.leetcodeProfile && student.normalizedProfile) {
        const platforms = student.normalizedProfile.platforms as any;
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
            consistencyScore: student.normalizedProfile.consistencyScore,
          });
          lcScore = lcAi.talentScore;
        }
      }

      // Canonical GitHub score
      let ghScore = 0;
      if (student.githubProfile) {
        const ghProfile = student.githubProfile;
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
        ghScore = ghAi.talentScore;
      }

      const active = {
        codechef: !!student.codechefProfile,
        leetcode: !!student.leetcodeProfile,
        github: !!student.githubProfile,
      };

      const computedOverall = OverallScoreService.calculate(
        { codechef: ccScore, leetcode: lcScore, github: ghScore },
        active
      );

      const targetStars = student.codechefProfile?.stars ?? 0;

      // Print before and after
      console.log(`[REPAIR] Student: ${student.name}`);
      console.log(`  CodeChef Score: ${le.codechefScore} -> ${ccScore}`);
      console.log(`  LeetCode Score: ${le.leetcodeScore} -> ${lcScore}`);
      console.log(`  GitHub Score  : ${le.githubScore} -> ${ghScore}`);
      console.log(`  Overall Score : ${le.overallScore} -> ${computedOverall}`);
      console.log(`  Stars Cache   : ${le.stars} -> ${targetStars}`);

      await tx.leaderboardEntry.update({
        where: { id: le.id },
        data: {
          codechefScore: ccScore,
          leetcodeScore: lcScore,
          githubScore: ghScore,
          overallScore: computedOverall,
          stars: targetStars,
        }
      });
    }

    // 3. Rebuild global ranks deterministically inside the transaction
    console.log("Restoring overall ranking standings descending...");
    // Retrieve updated leaderboard entries to perform correct sequencing
    const updatedEntries = await tx.leaderboardEntry.findMany({
      include: {
        student: {
          include: {
            codechefProfile: true
          }
        }
      }
    });

    updatedEntries.sort((a, b) => {
      if (b.overallScore !== a.overallScore) {
        return b.overallScore - a.overallScore;
      }
      const aCcRating = a.student.codechefProfile?.currentRating || 0;
      const bCcRating = b.student.codechefProfile?.currentRating || 0;
      if (bCcRating !== aCcRating) {
        return bCcRating - aCcRating;
      }
      if (b.talentScore !== a.talentScore) {
        return b.talentScore - a.talentScore;
      }
      return a.id.localeCompare(b.id);
    });

    for (let idx = 0; idx < updatedEntries.length; idx++) {
      const entry = updatedEntries[idx];
      const prevRank = entry.rank;
      const nextRank = idx + 1;
      if (prevRank !== nextRank) {
        console.log(`  Rank Change for ${entry.student.name}: ${prevRank} -> ${nextRank}`);
      }
      await tx.leaderboardEntry.update({
        where: { id: entry.id },
        data: { rank: nextRank }
      });
    }
  }, {
    timeout: 30000
  });

  console.log("\nTransaction successfully completed! Canonical scores and ranks rebuilt.");
  await prisma.$disconnect();
}

function generateDryRunMarkdown(issues: DiagnosticIssue[]): string {
  let md = `# Data Cleaning Dry-Run Audit Report\n\n`;
  md += `This report outlines data-quality anomalies identified in the student profile registry and platform records.\n\n`;
  md += `## Summary of Issues Found\n\n`;
  md += `Total Issues Detected: **${issues.length}**\n\n`;

  if (issues.length === 0) {
    md += `> [Spacer]\n> No data anomalies were found. The database is clean!\n`;
    return md;
  }

  md += `| Issue Type | Affected ID | Field | Current Value | Proposed Value | Risk | Action Recommendation |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  issues.forEach((issue) => {
    md += `| ${issue.type} | \`${issue.recordId}\` | \`${issue.field}\` | \`${issue.currentValue}\` | \`${issue.proposedValue}\` | ${issue.risk} | **${issue.recommendation}** |\n`;
  });

  md += `\n\n## Recommendations Details\n\n`;
  issues.forEach((issue, idx) => {
    md += `### ${idx + 1}. ${issue.type} on ID \`${issue.recordId}\`\n`;
    md += `- **Field**: \`${issue.field}\`\n`;
    md += `- **Reason**: ${issue.reason}\n`;
    md += `- **Risk Category**: ${issue.risk}\n`;
    md += `- **Proposed Mitigation**: ${issue.proposedValue}\n`;
    md += `- **Action Recommendation**: ${issue.recommendation}\n\n`;
  });

  return md;
}

run().catch((err) => {
  console.error("Cleanup script failed:", err);
  process.exit(1);
});
