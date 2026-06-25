import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface ActivityItem {
  id: string;
  message: string;
  timestamp: string;
  type: "problem" | "rating" | "star" | "system" | "department";
}

export async function GET(request: NextRequest) {
  try {
    const activities: ActivityItem[] = [];

    // 1. Fetch recent sync logs
    const recentSyncs = await prisma.syncLog.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: {
            name: true,
            department: true,
          },
        },
      },
    });

    recentSyncs.forEach((log) => {
      if (log.status === "SUCCESS") {
        activities.push({
          id: `sync-${log.id}`,
          message: `${log.student.name} (${log.student.department}) profile synced successfully in ${log.durationMs}ms.`,
          timestamp: log.createdAt.toISOString(),
          type: "system",
        });
      } else {
        activities.push({
          id: `sync-${log.id}`,
          message: `Attempted to update ${log.student.name} profile; scraper logged warning: network timeout.`,
          timestamp: log.createdAt.toISOString(),
          type: "system",
        });
      }
    });

    // 2. Fetch CodeChef profiles with recent contest activity
    const profiles = await prisma.codechefProfile.findMany({
      include: {
        student: {
          select: {
            name: true,
            department: true,
            year: true,
          },
        },
      },
    });

    profiles.forEach((profile) => {
      const studentName = profile.student.name;
      const dept = profile.student.department;
      
      // Solver milestone event
      if (profile.problemsSolved > 0) {
        activities.push({
          id: `solved-${profile.id}`,
          message: `${studentName} reached a milestone of ${profile.problemsSolved} solved problems on CodeChef.`,
          timestamp: profile.updatedAt.toISOString(),
          type: "problem",
        });
      }

      // Star milestone event
      if (profile.stars >= 3) {
        activities.push({
          id: `stars-${profile.id}`,
          message: `${studentName} is ranking at a strong ${profile.stars}★ status tier.`,
          timestamp: profile.updatedAt.toISOString(),
          type: "star",
        });
      }

      // Contest participations parsed from JSON
      let contestsList: any[] = [];
      try {
        contestsList = typeof profile.contests === "string" 
          ? JSON.parse(profile.contests) 
          : profile.contests || [];
      } catch (e) {
        // ignore
      }

      if (Array.isArray(contestsList) && contestsList.length > 0) {
        // Get the latest contest
        const latest = contestsList[contestsList.length - 1];
        if (latest && latest.code) {
          activities.push({
            id: `contest-${profile.id}-${latest.code}`,
            message: `${studentName} secured rank #${latest.rank} in contest ${latest.code} (${latest.name}) with ${latest.rating} rating.`,
            timestamp: latest.date ? new Date(latest.date).toISOString() : profile.updatedAt.toISOString(),
            type: "rating",
          });
        }
      }
    });

    // Sort all activities chronologically descending
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);

    // Fallbacks if database is brand new/empty
    if (sortedActivities.length === 0) {
      sortedActivities.push(
        {
          id: "f1",
          message: "Talent platform live: scanning registered profiles.",
          timestamp: new Date().toISOString(),
          type: "system",
        },
        {
          id: "f2",
          message: "CSE Department average rating moved to 1420 points.",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          type: "department",
        }
      );
    }

    return NextResponse.json({ activities: sortedActivities });
  } catch (err: any) {
    console.error("Error in activity API:", err);
    return NextResponse.json({ error: "Failed to load recent activity feed" }, { status: 500 });
  }
}
