import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

async function checkAdmin() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const role = (user.user_metadata?.role || "STUDENT").toUpperCase();
    return role === "ADMIN";
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all student profiles with their CodeChef status
    const students = await prisma.studentProfile.findMany({
      include: {
        codechefProfile: {
          select: {
            currentRating: true,
            stars: true,
            lastFetchedAt: true,
          },
        },
        aiAnalysis: {
          select: {
            talentScore: true,
          },
        },
      },
      orderBy: { rollNumber: "asc" },
    });

    return NextResponse.json({ students });
  } catch (err: any) {
    console.error("Error in admin students list API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, name } = await request.json();

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: "Missing id or name in request body" }, { status: 400 });
    }

    const updated = await prisma.studentProfile.update({
      where: { id },
      data: { name: name.trim() },
    });

    // Write an activity log
    await prisma.activityLog.create({
      data: {
        eventType: "PROFILE_UPDATE",
        studentId: id,
        message: `Student name was updated to ${name.trim()}`,
      },
    });

    return NextResponse.json({ success: true, student: updated });
  } catch (err: any) {
    console.error("Error updating student name:", err);
    return NextResponse.json({ error: err.message || "Failed to update student name" }, { status: 500 });
  }
}
