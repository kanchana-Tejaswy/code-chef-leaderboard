import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerformWrite } from "@/lib/write-access";
import { SyncService } from "@/services/sync.service";
import { revalidatePath } from "next/cache";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!canPerformWrite(request)) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin role required or write access disabled." },
        { status: 403 }
      );
    }

    const { id: studentId } = await params;
    const body = await request.json().catch(() => ({}));
    
    const { 
      name, 
      rollNumber, 
      department, 
      year, 
      branch, 
      section, 
      codechefUsername, 
      leetcodeUsername, 
      githubUsername 
    } = body;

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    // Retrieve old student record to check if usernames changed
    const oldStudent = await prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!oldStudent) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    // Clean up empty strings to null for usernames
    const normalizeUsername = (username: any) => {
        if (typeof username !== "string") return null;
        const trimmed = username.trim();
        return trimmed === "" ? null : trimmed;
    };

    const newCodechef = normalizeUsername(codechefUsername);
    const newLeetcode = normalizeUsername(leetcodeUsername);
    const newGithub = normalizeUsername(githubUsername);

    const isPlatformChanged = 
      oldStudent.codechefUsername !== newCodechef ||
      oldStudent.leetcodeUsername !== newLeetcode ||
      oldStudent.githubUsername !== newGithub;

    // Update database record
    const updatedStudent = await prisma.studentProfile.update({
      where: { id: studentId },
      data: { 
        name: name.trim(),
        rollNumber: rollNumber?.trim() || null,
        department: department?.trim() || null,
        year: year ? parseInt(year, 10) : null,
        branch: branch?.trim() || null,
        section: section?.trim() || null,
        codechefUsername: newCodechef,
        leetcodeUsername: newLeetcode,
        githubUsername: newGithub,
      },
    });

    if (isPlatformChanged) {
      // Changed platform URLs trigger profile resync
      // Trigger sync manually without waiting if we don't want to block, but the prompt says 
      // "Server verifies ADMIN role -> Database record is updated -> Changed platform URLs trigger profile resync"
      // We will await it so the client knows it's done and gets the latest data
      
      const syncResult = await SyncService.syncStudent(studentId, "ADMIN_FORCE");
      if (!syncResult.success) {
        // We log the error but still return success for the update part
        console.error("Sync failed after admin update:", syncResult.error);
      }
    } else {
      // If no platform URLs were changed, we invalidate caches directly since sync is skipped
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      revalidatePath(`/student/${studentId}`);
    }

    // Fetch the updated student profile with included data to return to the frontend
    const finalStudent = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: {
            codechefProfile: true,
            leetcodeProfile: true,
            githubProfile: true,
            aiAnalysis: true,
            leaderboardEntry: true,
        },
    });

    return NextResponse.json({ success: true, student: finalStudent });
  } catch (err: any) {
    console.error("Error updating student details:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
