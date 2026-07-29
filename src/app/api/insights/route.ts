import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InsightsService } from "@/services/insights.service";

import { requireStaffReadAccess } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const access = await requireStaffReadAccess();
    const isHod = access.role === UserRole.HOD;
    const deptScope = isHod ? access.departmentId : null;

    const studentWhere = deptScope ? { department: deptScope } : {};
    const students = await prisma.studentProfile.findMany({
      where: studentWhere,
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    const insights = InsightsService.getInsights(students);

    return NextResponse.json(insights, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err: any) {
    console.error("Error in insights api:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Failed to load institutional insights" }, { status: 500 });
  }
}
