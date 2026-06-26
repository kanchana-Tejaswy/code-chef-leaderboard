import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Fetch recent 25 sync logs
    const logs = await prisma.syncLog.findMany({
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: {
            name: true,
            rollNumber: true,
          },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error("Error in admin logs API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
