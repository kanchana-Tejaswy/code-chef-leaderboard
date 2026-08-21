import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const account = await prisma.userAccess.findUnique({
      where: { id }
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Account not found." },
        { status: 404, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { targetId: id },
          { actorUserId: id },
          { actorUserId: account.authUserId },
          ...(account.email ? [{ metadata: { path: ["email"], equals: account.email } }] : [])
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return NextResponse.json({
      success: true,
      data: {
        account: {
          id: account.id,
          email: account.email,
          role: account.role,
          status: account.status
        },
        items: auditLogs
      }
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in GET /api/admin/accounts/[id]/audit:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
