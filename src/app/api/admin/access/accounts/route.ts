import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Prisma, UserRole, AccountStatus } from "@prisma/client";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminSession = await requireAdmin();
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    
    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role") as UserRole | null;
    const status = searchParams.get("status") as AccountStatus | null;
    const departmentId = searchParams.get("departmentId") || null;
    const sortBy = searchParams.get("sortBy") || "createdAt"; // "createdAt" or "lastLoginAt"
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";

    const where: Prisma.UserAccessWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { loginId: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (role && Object.values(UserRole).includes(role)) {
      where.role = role;
    }
    
    if (status && Object.values(AccountStatus).includes(status)) {
      where.status = status;
    }
    
    if (departmentId) {
      where.departmentId = departmentId;
    }

    const skip = (page - 1) * limit;

    const [total, accounts] = await Promise.all([
      prisma.userAccess.count({ where }),
      prisma.userAccess.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy === "lastLoginAt" ? "lastLoginAt" : "createdAt"]: order,
        },
        select: {
          id: true,
          loginId: true,
          email: true,
          role: true,
          status: true,
          departmentId: true,
          studentProfileId: true,
          firstLoginCompleted: true,
          mustSetPassword: true,
          approvedAt: true,
          passwordSetAt: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
    ]);

    // Optional audit log for viewing accounts list
    // Only log occasionally or if there's a specific search, to prevent log bloat
    if (search || role || status) {
      await recordAuditEvent({
        actorUserId: adminSession.authUserId,
        action: AuditAction.ACCESS_ACCOUNT_VIEWED,
        metadata: { search, role, status, departmentId, page, limit }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        items: accounts,
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
    console.error("Error in accounts API:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
