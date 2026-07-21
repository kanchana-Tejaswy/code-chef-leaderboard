import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const action = searchParams.get("action");
    const targetType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId");
    
    const where: any = {};
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;

    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          actorUserId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    }, {
      headers: {
        "Cache-Control": "private, no-store"
      }
    });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in audit API:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
