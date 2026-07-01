import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InsightsService } from "@/services/insights.service";

export async function GET(request: NextRequest) {
  try {
    const students = await prisma.studentProfile.findMany({
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    const insights = InsightsService.getInsights(students);

    return NextResponse.json(insights);
  } catch (err: any) {
    console.error("Error in insights api:", err);
    return NextResponse.json({ error: "Failed to load institutional insights" }, { status: 500 });
  }
}
