import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id: studentId } = await params;

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    if (!student.leetcodeUsername) {
      return NextResponse.json({ success: false, error: "Student has no LeetCode username configured" }, { status: 400 });
    }

    const result = await SyncService.syncStudent(studentId, "ADMIN_FORCE");

    if (result.success) {
      const updatedStudent = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: {
          leetcodeProfile: true,
          leaderboardEntry: true,
          codechefProfile: true,
          githubProfile: true
        }
      });
      return NextResponse.json({ success: true, student: updatedStudent });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[LeetCode Sync Endpoint Error]:", error);
    return NextResponse.json({ success: false, error: "Failed to synchronize LeetCode profile" }, { status: 500 });
  }
}
