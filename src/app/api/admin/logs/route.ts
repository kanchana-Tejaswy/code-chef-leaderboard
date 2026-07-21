import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    if (!(process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL)) {
      return NextResponse.json(
        { error: "POSTGRES_PRISMA_URL or POSTGRES_URL is not configured" },
        { status: 503 }
      );
    }

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
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Error in admin logs API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
