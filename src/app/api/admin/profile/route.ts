import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminAccess = await requireRole(UserRole.ADMIN, UserRole.GK_SIR);

    let profile = null;
    if (adminAccess.authUserId) {
      profile = await prisma.profile.findUnique({
        where: { authUserId: adminAccess.authUserId }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: adminAccess.id,
        authUserId: adminAccess.authUserId,
        email: adminAccess.email,
        loginId: adminAccess.loginId,
        role: adminAccess.role,
        status: adminAccess.status,
        departmentId: adminAccess.departmentId,
        lastLoginAt: adminAccess.lastLoginAt,
        createdAt: adminAccess.createdAt,
        fullName: profile?.name || (adminAccess.role === UserRole.GK_SIR ? "GK Sir" : "CODE AROHA System Admin"),
        avatarUrl: profile?.avatarUrl || null,
        contactNumber: null,
        canDeleteStudents: adminAccess.canDeleteStudents,
      }
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in GET /api/admin/profile:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminAccess = await requireRole(UserRole.ADMIN, UserRole.GK_SIR);

    const body = await request.json();
    const { fullName, avatarUrl } = body;

    if (body.email || body.role || body.status || body.authUserId || body.loginId) {
      return NextResponse.json(
        { success: false, error: "Modifying email, role, status, or system IDs directly is not permitted." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (!fullName || typeof fullName !== "string" || fullName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Full Name is required." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const trimmedName = fullName.trim();

    if (adminAccess.authUserId && adminAccess.email) {
      await prisma.profile.upsert({
        where: { email: adminAccess.email },
        update: {
          name: trimmedName,
          avatarUrl: avatarUrl ? String(avatarUrl) : undefined,
          authUserId: adminAccess.authUserId
        },
        create: {
          authUserId: adminAccess.authUserId,
          email: adminAccess.email,
          name: trimmedName,
          role: adminAccess.role,
          avatarUrl: avatarUrl ? String(avatarUrl) : undefined,
        }
      });
    }

    await recordAuditEvent({
      actorUserId: adminAccess.id,
      action: AuditAction.PROFILE_UPDATED,
      targetType: "UserAccess",
      targetId: adminAccess.id,
      metadata: { fullName: trimmedName }
    });

    return NextResponse.json({
      success: true,
      message: "Admin profile updated successfully.",
      data: {
        fullName: trimmedName,
        avatarUrl: avatarUrl || null
      }
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in PATCH /api/admin/profile:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
