import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AiEngineService } from "@/services/ai-engine.service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  
  // Option A: Fetch and analyze by User ID
  if (userId) {
    try {
      const student = await prisma.studentProfile.findUnique({
        where: { id: userId },
        include: {
          codechefProfile: true,
        },
      });

      if (!student) {
        return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
      }

      if (!student.codechefProfile) {
        return NextResponse.json(
          { error: "No synchronized CodeChef metrics found for this student. Trigger a sync first." },
          { status: 400 }
        );
      }

      const ccProfile = student.codechefProfile;
      const parsedContests = typeof ccProfile.contests === "string" 
        ? JSON.parse(ccProfile.contests) 
        : ccProfile.contests || [];

      // Generate report using active service math
      const report = AiEngineService.generateScoringReport({
        currentRating: ccProfile.currentRating,
        highestRating: ccProfile.highestRating,
        stars: ccProfile.stars,
        problemsSolved: ccProfile.problemsSolved,
        contestCount: ccProfile.contestCount,
        contests: parsedContests,
      });

      return NextResponse.json(report);
    } catch (err: any) {
      console.error("Error in AI analysis API:", err);
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
  }

  // Option B: Direct sandbox metrics calculation
  const ratingStr = searchParams.get("rating");
  const solvedStr = searchParams.get("solved");
  const contestsStr = searchParams.get("contests");

  if (ratingStr && solvedStr && contestsStr) {
    const currentRating = parseInt(ratingStr, 10);
    const problemsSolved = parseInt(solvedStr, 10);
    const contestCount = parseInt(contestsStr, 10);

    if (isNaN(currentRating) || isNaN(problemsSolved) || isNaN(contestCount)) {
      return NextResponse.json(
        { error: "Parameters rating, solved, and contests must be valid numbers." },
        { status: 400 }
      );
    }

    try {
      const report = AiEngineService.generateScoringReport({
        currentRating,
        highestRating: currentRating, // Assume highest is same as current for fallback
        stars: 1, // Will be inferred in calculation formulas if needed
        problemsSolved,
        contestCount,
        contests: [], // Assume no recent dates for fallback recency
      });

      return NextResponse.json(report);
    } catch (err: any) {
      console.error("Error in direct AI analysis API:", err);
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Missing parameters. Provide either 'userId' or 'rating', 'solved', and 'contests'." },
    { status: 400 }
  );
}
