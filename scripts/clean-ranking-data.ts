import * as fs from "fs";
import * as path from "path";

// Load .env variables before importing prisma
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
  const isDryRun = !isApply;

  console.log(`=== ACE DATA CLEANING & RANKING REBUILD ===`);
  console.log(`Mode: ${isApply ? "APPLY CORRECTIONS" : "DRY RUN (DIAGNOSIS)"}\n`);

  // Dynamically import prisma to ensure process.env is populated first
  const { prisma } = await import("../src/lib/prisma");

  const issues: DiagnosticIssue[] = [];

  // 1. Load data
  const students = await prisma.studentProfile.findMany({
    include: {
      codechefProfile: true,
      leetcodeProfile: true,
      githubProfile: true,
      leaderboardEntry: true,
    }
  });

  const leaderboardEntries = await prisma.leaderboardEntry.findMany({
    include: {
      student: true
    }
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

  // Check 3: StudentProfile formatting issues (whitespaces, empty strings, casing, department, etc.)
  students.forEach((s) => {
    // Name
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

    // Roll Number
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

    // Platform handles spaces or casing
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

    // Inconsistent Department
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

    // Inconsistent Section
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

    // Academic Year
    if (s.year && (s.year < 1 || s.year > 4)) {
      issues.push({
        type: "IMPOSSIBLE_ACADEMIC_YEAR",
        recordId: s.id,
        field: "year",
        currentValue: s.year,
        proposedValue: null,
        reason: "Academic year must be between 1 and 4",
        risk: "Medium",
        recommendation: "REVIEW"
      });
    }
  });

  // Check 4: Leaderboard Entry & Platform Score Mismatch / Missing profiles
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
    } else {
      // Mismatch between platform ratings/scores and leaderboard entries
      const le = s.leaderboardEntry;
      const ccRating = s.codechefProfile?.currentRating || 0;
      const ccStars = s.codechefProfile?.stars || 0;

      if (le.rating !== ccRating) {
        issues.push({
          type: "LEADERBOARD_RATING_MISMATCH",
          recordId: s.id,
          field: "rating",
          currentValue: le.rating,
          proposedValue: ccRating,
          reason: `Leaderboard rating cache (${le.rating}) mismatch with CodeChef Profile (${ccRating})`,
          risk: "Low",
          recommendation: "APPLY"
        });
      }

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

  // Orphans Leaderboard Entries
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

  // Print Dry Run Results as Markdown File
  const dryRunContent = generateDryRunMarkdown(issues);
  
  if (isDryRun) {
    console.log(`Diagnostics complete! Found ${issues.length} issue(s).`);
    console.log(`Writing results to DATA_CLEANING_DRY_RUN.md...`);
    fs.writeFileSync("DATA_CLEANING_DRY_RUN.md", dryRunContent);
  } else {
    // APPLY CHANGES
    console.log(`Applying changes...`);
    let appliedCount = 0;
    
    // We transactionally apply corrections
    await prisma.$transaction(async (tx) => {
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
    });

    console.log(`Applied ${appliedCount} database updates.`);

    // Recompute scores and rebuild ranking cache
    console.log(`Recomputing scores and rebuilding global rank cache...`);
    const allEntries = await prisma.leaderboardEntry.findMany({
      include: {
        student: {
          include: {
            codechefProfile: true,
            leetcodeProfile: true,
            githubProfile: true,
            aiAnalysis: true,
          }
        }
      }
    });

    // Helper mapping for weights
    const codechefWeight = 0.35;
    const leetcodeWeight = 0.35;
    const githubWeight = 0.30;

    await prisma.$transaction(
      allEntries.map((le) => {
        const student = le.student;
        if (!student) return prisma.leaderboardEntry.update({ where: { id: le.id }, data: {} });

        // Grab raw ratings and AI scores
        const ccScore = student.codechefProfile?.currentRating ? Math.round(student.codechefProfile.currentRating / 30) : 0;
        const lcScore = student.leetcodeProfile?.problemsSolved ? Math.round(student.leetcodeProfile.problemsSolved / 10) : 0;
        const ghScore = student.githubProfile?.openSourceScore || 0;

        const active = {
          codechef: !!student.codechefProfile,
          leetcode: !!student.leetcodeProfile,
          github: !!student.githubProfile,
        };

        let weightedSum = 0;
        let totalWeight = 0;
        if (active.codechef) {
          weightedSum += ccScore * codechefWeight;
          totalWeight += codechefWeight;
        }
        if (active.leetcode) {
          weightedSum += lcScore * leetcodeWeight;
          totalWeight += leetcodeWeight;
        }
        if (active.github) {
          weightedSum += ghScore * githubWeight;
          totalWeight += githubWeight;
        }

        const recomputedOverall = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight);

        return prisma.leaderboardEntry.update({
          where: { id: le.id },
          data: {
            rating: student.codechefProfile?.currentRating || 0,
            stars: student.codechefProfile?.stars || 1,
            codechefScore: ccScore,
            leetcodeScore: lcScore,
            githubScore: ghScore,
            overallScore: recomputedOverall,
          }
        });
      })
    );

    // Rebuild global rank using Postgres standard ordering
    console.log(`Rebuilding ranks in leaderboard...`);
    const sortedEntries = await prisma.leaderboardEntry.findMany({
      orderBy: [
        { overallScore: "desc" },
        { rating: "desc" },
        { talentScore: "desc" },
        { id: "asc" }
      ]
    });

    await prisma.$transaction(
      sortedEntries.map((entry, index) =>
        prisma.leaderboardEntry.update({
          where: { id: entry.id },
          data: { rank: index + 1 }
        })
      )
    );

    console.log(`Global rank cache rebuilt completely!`);
  }

  await prisma.$disconnect();
}

function generateDryRunMarkdown(issues: DiagnosticIssue[]): string {
  let md = `# Data Cleaning Dry-Run Audit Report\n\n`;
  md += `This report outlines data-quality anomalies identified in the student profile registry and platform records.\n\n`;
  md += `## Summary of Issues Found\n\n`;
  md += `Total Issues Detected: **${issues.length}**\n\n`;

  if (issues.length === 0) {
    md += `> [!NOTE]\n> No data anomalies were found. The database is clean!\n`;
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
