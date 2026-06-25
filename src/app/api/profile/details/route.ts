import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
  }

  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: userId },
      include: {
        codechefProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile: student });
  } catch (err: any) {
    console.error("Error fetching detailed profile:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
