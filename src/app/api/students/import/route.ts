import { NextRequest, NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { SyncService } from "@/services/sync.service";
import { StudentProfileService } from "@/services/student-profile.service";

const MAX_ROWS = 500; // Increased safety cap for bulk imports

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const { action, rows, autoSync } = body;

    if (action !== "preview" && action !== "import") {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use 'preview' or 'import'." },
        { status: 400 }
      );
    }

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'rows' array." },
        { status: 400 }
      );
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `Maximum row limit exceeded. Max limit is ${MAX_ROWS} rows per batch.` },
        { status: 400 }
      );
    }

    if (action === "preview") {
      const evaluated = await StudentProfileService.evaluateRows(rows);

      let readyCount = 0;
      let incompleteCount = 0;
      let duplicateRollCount = 0;
      let duplicateEmailCount = 0;
      let duplicatePlatformCount = 0;
      let invalidCount = 0;

      const previewRows = evaluated.map((e) => {
        if (e.hadDuplicateHandle) duplicatePlatformCount++;
        if (e.classification === "READY") readyCount++;
        else if (e.classification === "INCOMPLETE") incompleteCount++;
        else if (e.classification === "DUPLICATE_ROLL_NUMBER") duplicateRollCount++;
        else if (e.classification === "DUPLICATE_EMAIL") duplicateEmailCount++;
        else invalidCount++;

        return {
          index: e.index,
          rowNumber: e.index + 1,
          name: e.normalized.name || e.raw.name || "",
          rollNumber: e.normalized.rollNumber || e.raw.rollNumber || e.raw.roll_number || "",
          email: e.normalized.email || e.raw.email || "",
          contactNumber: e.normalized.contactNumber || e.raw.contactNumber || e.raw.contact_number || "",
          year: e.normalized.year,
          branch: e.normalized.branch,
          department: e.normalized.department,
          section: e.normalized.section,
          cgpa: e.normalized.cgpa,
          codechefUsername: e.normalized.codechefUsername,
          leetcodeUsername: e.normalized.leetcodeUsername,
          codeforcesUsername: e.normalized.codeforcesUsername,
          githubUsername: e.normalized.githubUsername,
          linkedinUrl: e.normalized.linkedinUrl,
          classification: e.classification,
          reasons: e.reasons,
          hadDuplicateHandle: Boolean(e.hadDuplicateHandle),
        };
      });

      return NextResponse.json({
        success: true,
        summary: {
          total: rows.length,
          ready: readyCount,
          incomplete: incompleteCount,
          duplicateRollNumber: duplicateRollCount,
          duplicateEmail: duplicateEmailCount,
          duplicatePlatformUsername: duplicatePlatformCount,
          invalid: invalidCount,
        },
        rows: previewRows,
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    // Action is "import"
    // Revalidate all rows on server - NEVER trust preview results sent from browser
    const importResult = await StudentProfileService.processBulkCsvImport(rows);

    // Queue autoSync for newly imported students with concurrency limit = 2
    if (autoSync && importResult.importedIds.length > 0) {
      const idsToSync = importResult.importedIds;
      after(async () => {
        console.log(`[Bulk Import] Starting queued background sync for ${idsToSync.length} students...`);
        const CONCURRENCY = 2;
        for (let i = 0; i < idsToSync.length; i += CONCURRENCY) {
          const chunk = idsToSync.slice(i, i + CONCURRENCY);
          await Promise.all(
            chunk.map(async (id) => {
              try {
                await SyncService.syncStudent(id, "ADMIN_FORCE", true);
                await new Promise((r) => setTimeout(r, 1000));
              } catch (err) {
                console.error(`AutoSync failed for imported student ${id}:`, err);
              }
            })
          );
        }
        await SyncService.recalculateLeaderboardRanks();
      });
    }

    return NextResponse.json({
      success: true,
      summary: importResult.summary,
      rowDetails: importResult.rowDetails,
      importedIds: importResult.importedIds,
    }, { headers: { "Cache-Control": "private, no-store" } });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    console.error("Error in CSV import API:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error during CSV import." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
