import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const branch = searchParams.get("branch")?.trim() || searchParams.get("department")?.trim();
    const yearStr = searchParams.get("year")?.trim();
    const profileStatus = searchParams.get("profileStatus")?.trim();
    const leaderboardEligibleStr = searchParams.get("leaderboardEligible")?.trim();

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { rollNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (branch && branch !== "ALL") {
      where.OR = [
        { branch: { equals: branch, mode: "insensitive" } },
        { department: { equals: branch, mode: "insensitive" } },
      ];
    }

    if (yearStr && yearStr !== "ALL") {
      const parsedYear = parseInt(yearStr, 10);
      if (!isNaN(parsedYear)) {
        where.year = parsedYear;
      }
    }

    if (profileStatus && profileStatus !== "ALL") {
      where.profileStatus = profileStatus;
    }

    if (leaderboardEligibleStr && leaderboardEligibleStr !== "ALL") {
      where.leaderboardEligible = leaderboardEligibleStr === "true";
    }

    const [total, students] = await Promise.all([
      prisma.studentProfile.count({ where }),
      prisma.studentProfile.findMany({
        where,
        include: {
          codechefProfile: {
            select: {
              username: true,
              currentRating: true,
              stars: true,
              lastFetchedAt: true,
            },
          },
          leetcodeProfile: {
            select: {
              username: true,
              contestRating: true,
              contestRank: true,
              problemsSolved: true,
            },
          },
          githubProfile: {
            select: {
              username: true,
              totalRepositories: true,
              totalStars: true,
            },
          },
          aiAnalysis: {
            select: {
              talentScore: true,
            },
          },
          leaderboardEntry: {
            select: {
              rank: true,
              overallScore: true,
              rating: true,
              stars: true,
              talentScore: true,
            },
          },
        },
        orderBy: { rollNumber: "asc" },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json(
      {
        success: true,
        students,
        total,
        page,
        limit,
        totalPages,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in admin students list API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
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
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error updating student via admin endpoint:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
