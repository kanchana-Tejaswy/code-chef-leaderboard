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
    const logs = await prisma.activityLog.findMany({
      take: 15,
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

    const activities: ActivityItem[] = logs.map((log) => {
      let type: "problem" | "rating" | "star" | "system" | "department" = "system";
      
      if (log.eventType === "RATING_INCREASE") {
        type = "rating";
      } else if (log.eventType === "STUDENT_ADD") {
        type = "system";
      } else if (log.eventType === "STUDENT_DELETE") {
        type = "system";
      } else if (log.eventType === "SYNC_SUCCESS") {
        type = "system";
      } else if (log.eventType === "SYNC_FAILURE") {
        type = "system";
      } else if (log.eventType.includes("SOLVED") || log.eventType.includes("PROBLEM")) {
        type = "problem";
      }

      return {
        id: log.id,
        message: log.message,
        timestamp: log.createdAt.toISOString(),
        type,
      };
    });

    return NextResponse.json({ activities });
  } catch (err: any) {
    console.error("Error in activity API:", err);
    return NextResponse.json({ error: "Failed to load recent activity feed" }, { status: 500 });
  }
}
