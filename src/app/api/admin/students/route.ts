import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerformWrite } from "@/lib/write-access";

export async function GET(request: NextRequest) {
  try {
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
  if (!canPerformWrite(request)) {
    return NextResponse.json(
      { error: "Student modifications are disabled in public read-only mode." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { id, name } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const student = await prisma.studentProfile.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({ success: true, student });
  } catch (err: any) {
    console.error("Error updating student via admin endpoint:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
