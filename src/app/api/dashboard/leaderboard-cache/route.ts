
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireLeaderboardAccess } from "@/lib/auth";
import { recordAuditEvent } from "@/services/audit.service";
import { UserRole } from "@prisma/client";
import * as XLSX from "xlsx";


type PlatformKey = "overall" | "codechef" | "leetcode";
type SortOrder = "asc" | "desc";

type PlatformConfig = {
  defaultSort: string;
  defaultOrder: SortOrder;
  applyFilters: (studentWhere: Prisma.StudentProfileWhereInput, params: URLSearchParams) => void;
  sortFields: Record<string, (order: SortOrder) => Prisma.LeaderboardEntryOrderByWithRelationInput[]>;
};

const parseNumbers = (value: string | null) =>
  value?.split(",").map(Number).filter((n) => !Number.isNaN(n)) || [];

const numericParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key);
  return value ? Number(value) : null;
};

const nullableOrder = (sort: SortOrder) => ({ sort, nulls: "last" });
const nestedOrder = (relation: string, field: string, sort: SortOrder) => ({
  student: {
    [relation]: {
      [field]: nullableOrder(sort),
    },
  },
}) as unknown as Prisma.LeaderboardEntryOrderByWithRelationInput;

import { OverallScoreService } from "@/services/overallScore.service";

const withCanonicalTieBreaker = (
  platform: PlatformKey,
  sortBy: string,
  orders: Prisma.LeaderboardEntryOrderByWithRelationInput[]
): Prisma.LeaderboardEntryOrderByWithRelationInput[] => {
  const result = [...orders];
  
  if (platform === "codechef" && sortBy !== "ccRating" && sortBy !== "ccHighestRating") {
    result.push(nestedOrder("codechefProfile", "currentRating", "desc"));
  } else if (platform === "leetcode" && sortBy !== "lcRating" && sortBy !== "lcRank") {
    result.push(nestedOrder("leetcodeProfile", "contestRating", "desc"));
  }

  if (sortBy !== "overallScore") {
    // If we're not primarily sorting by overall score, append the full competitive
    // tie-breaker at the end to ensure deterministic global ordering.
    result.push(...OverallScoreService.getCompetitiveSortOrder("desc"));
  }

  return result;
};

const platformConfigs: Record<PlatformKey, PlatformConfig> = {
  overall: {
    defaultSort: "overallScore",
    defaultOrder: "desc",
    applyFilters: () => {},
    sortFields: {
      overallScore: (order) => OverallScoreService.getCompetitiveSortOrder(order),
      talentScore: (order) => [{ talentScore: order }],
      consistency: (order) => [nestedOrder("normalizedProfile", "consistencyScore", order)],
      rank: (order) => [{ rank: order }],
    },
  },
  codechef: {
    defaultSort: "ccRating",
    defaultOrder: "desc",
    applyFilters: (studentWhere, params) => {
      const ratingMin = numericParam(params, "ccRatingMin");
      const ratingMax = numericParam(params, "ccRatingMax");
      const contestsMin = numericParam(params, "ccContestsMin");
      const stars = parseNumbers(params.get("stars"));
      const codechefProfile: Prisma.CodechefProfileWhereInput = {};

      if (ratingMin !== null || ratingMax !== null) {
        codechefProfile.currentRating = {};
        if (ratingMin !== null) codechefProfile.currentRating.gte = ratingMin;
        if (ratingMax !== null) codechefProfile.currentRating.lte = ratingMax;
      }

      if (contestsMin !== null) codechefProfile.contestCount = { gte: contestsMin };
      if (stars.length > 0) codechefProfile.stars = { in: stars };
      if (Object.keys(codechefProfile).length > 0) studentWhere.codechefProfile = { is: codechefProfile };
    },
    sortFields: {
      ccRating: (order) => [
        nestedOrder("codechefProfile", "currentRating", order),
        nestedOrder("codechefProfile", "highestRating", "desc"),
        nestedOrder("codechefProfile", "globalRank", "asc"),
      ],
      ccHighestRating: (order) => [
        nestedOrder("codechefProfile", "highestRating", order),
        nestedOrder("codechefProfile", "currentRating", "desc"),
      ],
      stars: (order) => [nestedOrder("codechefProfile", "stars", order)],
      ccGlobalRank: (order) => [nestedOrder("codechefProfile", "globalRank", order)],
      ccContests: (order) => [nestedOrder("codechefProfile", "contestCount", order)],
      ccRatingGrowth: (order) => [nestedOrder("codechefProfile", "highestRating", order)],
      codechefScore: (order) => [{ codechefScore: order }],
    },
  },
  leetcode: {
    defaultSort: "lcSolved",
    defaultOrder: "desc",
    applyFilters: (studentWhere, params) => {
      const ratingMin = numericParam(params, "lcRatingMin");
      const ratingMax = numericParam(params, "lcRatingMax");
      const easyMin = numericParam(params, "lcEasyMin");
      const mediumMin = numericParam(params, "lcMediumMin");
      const hardMin = numericParam(params, "lcHardMin");
      const leetcodeProfile: Prisma.LeetcodeProfileWhereInput = {};

      if (ratingMin !== null || ratingMax !== null) {
        leetcodeProfile.contestRating = {};
        if (ratingMin !== null) leetcodeProfile.contestRating.gte = ratingMin;
        if (ratingMax !== null) leetcodeProfile.contestRating.lte = ratingMax;
      }

      if (easyMin !== null) leetcodeProfile.easySolvedCount = { gte: easyMin };
      if (mediumMin !== null) leetcodeProfile.mediumSolvedCount = { gte: mediumMin };
      if (hardMin !== null) leetcodeProfile.hardSolvedCount = { gte: hardMin };
      if (Object.keys(leetcodeProfile).length > 0) studentWhere.leetcodeProfile = { is: leetcodeProfile };
    },
    sortFields: {
      lcRank: (order) => [nestedOrder("leetcodeProfile", "contestRank", order)],
      lcRating: (order) => [nestedOrder("leetcodeProfile", "contestRating", order)],
      lcSolved: (order) => [
        nestedOrder("leetcodeProfile", "problemsSolved", order),
        nestedOrder("leetcodeProfile", "hardSolvedCount", "desc"),
        nestedOrder("leetcodeProfile", "mediumSolvedCount", "desc"),
        nestedOrder("leetcodeProfile", "easySolvedCount", "desc"),
      ],
      lcInterviewReadiness: (order) => [{ leetcodeScore: order }],
      leetcodeScore: (order) => [{ leetcodeScore: order }],
    },
  },
};

const getPlatform = (value: string | null): PlatformKey =>
  value === "codechef" || value === "leetcode" ? value : "overall";

const buildWhereClause = (platform: PlatformKey, searchParams: URLSearchParams, forceDepartment?: string) => {
  const search = searchParams.get("search") || "";
  const departments = forceDepartment 
    ? [forceDepartment] 
    : searchParams.get("departments")?.split(",").filter(Boolean) || [];
  const years = parseNumbers(searchParams.get("years"));
  const studentWhere: Prisma.StudentProfileWhereInput = {};

  if (search) {
    studentWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { rollNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  if (departments.length > 0) studentWhere.department = { in: departments };
  if (years.length > 0) studentWhere.year = { in: years };

  platformConfigs[platform].applyFilters(studentWhere, searchParams);

  return Object.keys(studentWhere).length > 0 ? { student: studentWhere } : {};
};

const buildOrderBy = (platform: PlatformKey, searchParams: URLSearchParams) => {
  const config = platformConfigs[platform];
  const requestedSort = searchParams.get("sortBy") || config.defaultSort;
  const requestedOrder = (searchParams.get("sortOrder") || config.defaultOrder).toLowerCase() === "asc" ? "asc" : "desc";
  const sortFactory = config.sortFields[requestedSort] || config.sortFields[config.defaultSort];
  return withCanonicalTieBreaker(platform, requestedSort, sortFactory(requestedOrder));
};

const studentSelect = {
  id: true,
  name: true,
  rollNumber: true,
  department: true,
  year: true,
  codechefUsername: true,
  leetcodeUsername: true,
  githubUsername: true,
  profilePictureUrl: true,
  verificationStatus: true,
  codechefProfile: true,
  leetcodeProfile: true,
  githubProfile: true,
  aiAnalysis: true,
  normalizedProfile: true,
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = getPlatform(searchParams.get("platform"));
  const doExport = searchParams.get("export") === "true";

  try {
    const userAccess = await requireLeaderboardAccess();
    
    const departmentFilter = userAccess.role === UserRole.HOD ? userAccess.departmentId || undefined : undefined;

    const whereClause = buildWhereClause(platform, searchParams, departmentFilter);
    const orderBy = buildOrderBy(platform, searchParams);

    if (doExport) {
      if (userAccess.role === UserRole.GK_SIR) {
        await recordAuditEvent({
          actorUserId: userAccess.id,
          action: "GK_SIR_EXPORTED_REPORT",
          targetType: "LeaderboardEntry",
          metadata: { platform, query: searchParams.toString() },
        });
      }
      const entries = await prisma.leaderboardEntry.findMany({
        where: whereClause,
        include: {
          student: {
            select: studentSelect,
          },
        },
        orderBy,
      });

      const exportData = entries.map((e, idx) => ({
        Rank: idx + 1,
        Name: e.student.name,
        "Roll Number": e.student.rollNumber,
        Department: e.student.department,
        Year: e.student.year ? `${e.student.year} Year` : "Not Linked",
        "CodeChef Username": e.student.codechefUsername || "Not Linked",
        "LeetCode Username": e.student.leetcodeUsername || "Not Linked",
        "GitHub Username": e.student.githubUsername || "Not Linked",
        "Overall Score": e.overallScore,
        "CodeChef Score": e.codechefScore,
        "LeetCode Score": e.leetcodeScore,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leaderboard");
      worksheet["!cols"] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 15 },
        { wch: 12 },
        { wch: 8 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
      ];

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=ace_${platform}_leaderboard_${new Date().toISOString().split("T")[0]}.xlsx`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const skip = (page - 1) * limit;

    const getLeaderboardData = unstable_cache(
      async (wClause, oBy, s, l) => {
        const [entries, total] = await Promise.all([
          prisma.leaderboardEntry.findMany({
            where: wClause,
            include: {
              student: {
                select: studentSelect,
              },
            },
            orderBy: oBy,
            skip: s,
            take: l,
          }),
          prisma.leaderboardEntry.count({
            where: wClause,
          }),
        ]);
        return { entries, total };
      },
      [`leaderboard-cache-data-${departmentFilter || "ALL"}`],
      { revalidate: 60 }
    );

    const { entries, total } = await getLeaderboardData(whereClause, orderBy, skip, limit);

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: any) {
    console.error("Error fetching leaderboard cache API:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
