import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";
import { StudentProfileService } from "@/services/student-profile.service";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const { name, email, rollNumber, department, year, branch, section, contactNumber, cgpa, codechefUrl, leetcodeUrl, codeforcesUrl, githubUrl, linkedinUrl, url } = body;

    const rawInput = {
      name,
      email,
      rollNumber,
      department,
      year,
      branch,
      section,
      contactNumber,
      cgpa,
      codechefUrl: codechefUrl || url,
      leetcodeUrl,
      codeforcesUrl,
      githubUrl,
      linkedinUrl,
    };

    const evaluated = await StudentProfileService.evaluateRows([rawInput]);
    const row = evaluated[0];

    if (row.classification !== "READY" && row.classification !== "INCOMPLETE") {
      const errorMsg = row.reasons.join(" ") || "Invalid student profile data.";
      return NextResponse.json({ error: errorMsg, details: row }, { status: 400 });
    }

    const res = await StudentProfileService.createProfile(row.normalized);
    if (!res.success || !res.profile) {
      return NextResponse.json({ error: res.error || "Failed to create student profile." }, { status: 400 });
    }

    const student = res.profile;

    // Trigger scraping and AI analysis safely using after()
    after(async () => {
      try {
        if (row.normalized.codechefUsername || row.normalized.leetcodeUsername) {
          await SyncService.syncStudent(student.id, "USER_MANUAL");
          await SyncService.recalculateLeaderboardRanks();
        }
      } catch (e) {
        console.error("Sync error:", e);
      }
    });

    const finalStudent = await prisma.studentProfile.findUnique({
      where: { id: student.id },
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Student profile registered successfully.",
      student: finalStudent,
    }, { headers: { "Cache-Control": "private, no-store" } });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in student analyze API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
