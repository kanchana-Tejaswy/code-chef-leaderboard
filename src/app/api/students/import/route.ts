import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerformWrite } from "@/lib/write-access";
import { SyncService } from "@/services/sync.service";

const MAX_ROWS = 100; // Limit for demo safety

interface ImportRow {
  name?: string;
  roll_number?: string;
  department?: string;
  year?: string;
  branch?: string;
  section?: string;
  codechef_username?: string;
  leetcode_username?: string;
  github_username?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!canPerformWrite(request)) {
      return NextResponse.json(
        { error: "CSV import is restricted in public read-only mode." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action, rows, autoSync } = body;

    if (action !== "preview" && action !== "import") {
      return NextResponse.json({ error: "Invalid action. Use 'preview' or 'import'." }, { status: 400 });
    }

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing or invalid 'rows' array." }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Maximum row limit exceeded. Max is ${MAX_ROWS} rows.` }, { status: 400 });
    }

    // Fetch existing students for duplicate check
    const allDbStudents = await prisma.studentProfile.findMany({
      select: {
        id: true,
        rollNumber: true,
        codechefUsername: true,
        leetcodeUsername: true,
        githubUsername: true,
      }
    });

    const dbRollMap = new Map(allDbStudents.filter(s => s.rollNumber).map(s => [s.rollNumber!.toUpperCase(), s]));
    const dbCcMap = new Map(allDbStudents.filter(s => s.codechefUsername).map(s => [s.codechefUsername!.toLowerCase(), s]));
    const dbLcMap = new Map(allDbStudents.filter(s => s.leetcodeUsername).map(s => [s.leetcodeUsername!.toLowerCase(), s]));
    const dbGhMap = new Map(allDbStudents.filter(s => s.githubUsername).map(s => [s.githubUsername!.toLowerCase(), s]));

    const processedRows: any[] = [];
    const rollSeenInCsv = new Set<string>();
    const ccSeenInCsv = new Set<string>();
    const lcSeenInCsv = new Set<string>();
    const ghSeenInCsv = new Set<string>();

    let validCount = 0;
    let invalidCount = 0;

    for (let index = 0; index < rows.length; index++) {
      const rawRow: ImportRow = rows[index];
      const name = rawRow.name?.trim() || "";
      const rollNumber = rawRow.roll_number?.trim().toUpperCase() || "";
      const department = rawRow.department?.trim() || "CSE";
      const branch = rawRow.branch?.trim() || department;
      const section = rawRow.section?.trim().toUpperCase() || "A";
      const ccUser = rawRow.codechef_username?.trim() || null;
      const lcUser = rawRow.leetcode_username?.trim() || null;
      const ghUser = rawRow.github_username?.trim() || null;
      const rawYear = rawRow.year?.trim() || "3";
      
      const parsedYear = parseInt(rawYear, 10);
      const errors: string[] = [];

      // Validation
      if (!name) {
        errors.push("Name is required");
      }
      if (!rollNumber) {
        errors.push("Roll number is required");
      }
      if (isNaN(parsedYear) || parsedYear <= 0) {
        errors.push(`Invalid year value: ${rawYear}`);
      }

      // Check CSV duplicates
      if (rollNumber) {
        if (rollSeenInCsv.has(rollNumber)) {
          errors.push(`Duplicate roll number in CSV: ${rollNumber}`);
        } else {
          rollSeenInCsv.add(rollNumber);
        }
      }
      
      if (ccUser) {
        const ccLower = ccUser.toLowerCase();
        if (ccSeenInCsv.has(ccLower)) {
          errors.push(`Duplicate CodeChef handle in CSV: ${ccUser}`);
        } else {
          ccSeenInCsv.add(ccLower);
        }
      }

      if (lcUser) {
        const lcLower = lcUser.toLowerCase();
        if (lcSeenInCsv.has(lcLower)) {
          errors.push(`Duplicate LeetCode handle in CSV: ${lcUser}`);
        } else {
          lcSeenInCsv.add(lcLower);
        }
      }

      if (ghUser) {
        const ghLower = ghUser.toLowerCase();
        if (ghSeenInCsv.has(ghLower)) {
          errors.push(`Duplicate GitHub handle in CSV: ${ghUser}`);
        } else {
          ghSeenInCsv.add(ghLower);
        }
      }

      // Classify row status
      let classification: "CREATE" | "UPDATE" | "REVIEW" | "REJECT" = "CREATE";
      const existingStudentByRoll = dbRollMap.get(rollNumber);

      if (existingStudentByRoll) {
        classification = "UPDATE";
      }

      // Check database handle conflicts
      const checkHandleConflict = (username: string | null, map: Map<string, any>, platform: string) => {
        if (!username) return;
        const matchingDbStudent = map.get(username.toLowerCase());
        if (matchingDbStudent) {
          // If it is another student, it is a conflict
          if (!existingStudentByRoll || existingStudentByRoll.id !== matchingDbStudent.id) {
            errors.push(`Database conflict: ${platform} handle '${username}' belongs to roll number ${matchingDbStudent.rollNumber}`);
          }
        }
      };

      checkHandleConflict(ccUser, dbCcMap, "CodeChef");
      checkHandleConflict(lcUser, dbLcMap, "LeetCode");
      checkHandleConflict(ghUser, dbGhMap, "GitHub");

      if (errors.length > 0) {
        classification = "REJECT";
        invalidCount++;
      } else {
        validCount++;
      }

      processedRows.push({
        index,
        name,
        rollNumber,
        department,
        branch,
        section,
        year: isNaN(parsedYear) ? 3 : parsedYear,
        codechefUsername: ccUser,
        leetcodeUsername: lcUser,
        githubUsername: ghUser,
        errors,
        classification
      });
    }

    if (action === "preview") {
      return NextResponse.json({
        success: true,
        summary: {
          total: rows.length,
          valid: validCount,
          invalid: invalidCount,
        },
        rows: processedRows
      });
    }

    // Action is "import"
    // Filter rows that are rejected
    const importableRows = processedRows.filter(r => r.classification !== "REJECT");
    const importedIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of importableRows) {
        if (row.classification === "UPDATE") {
          const updated = await tx.studentProfile.update({
            where: { rollNumber: row.rollNumber },
            data: {
              name: row.name,
              department: row.department,
              branch: row.branch,
              section: row.section,
              year: row.year,
              codechefUsername: row.codechefUsername,
              leetcodeUsername: row.leetcodeUsername,
              githubUsername: row.githubUsername,
            }
          });
          importedIds.push(updated.id);
        } else {
          const created = await tx.studentProfile.create({
            data: {
              name: row.name,
              rollNumber: row.rollNumber,
              department: row.department,
              branch: row.branch,
              section: row.section,
              year: row.year,
              codechefUsername: row.codechefUsername,
              leetcodeUsername: row.leetcodeUsername,
              githubUsername: row.githubUsername,
            }
          });
          importedIds.push(created.id);
        }
      }
    });

    // Rebuild ranks immediately after transaction completes
    console.log(`Rebuilding leaderboard ranks for ${importedIds.length} imported students...`);
    await SyncService.recalculateLeaderboardRanks();

    // Trigger background sync if requested
    if (autoSync && importedIds.length > 0) {
      console.log(`AutoSync requested. Syncing ${importedIds.length} profiles...`);
      // Trigger background sync sequentially
      (async () => {
        for (const id of importedIds) {
          try {
            await SyncService.syncStudent(id, "USER_MANUAL");
            // Delay slightly to respect rate limits
            await new Promise(r => setTimeout(r, 1000));
          } catch (e) {
            console.error(`AutoSync failed for student ${id}:`, e);
          }
        }
        // Recalculate ranks one final time after all profiles are synced
        await SyncService.recalculateLeaderboardRanks();
      })().catch(e => console.error("AutoSync batch execution error:", e));
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        attempted: importableRows.length,
        created: importableRows.filter(r => r.classification === "CREATE").length,
        updated: importableRows.filter(r => r.classification === "UPDATE").length,
        rejected: invalidCount,
      },
      importedIds
    });

  } catch (err: any) {
    console.error("Error in CSV import API:", err);
    return NextResponse.json({ error: "Internal server error: " + err.message }, { status: 500 });
  }
}
