import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const { role: newRole, adminConfirmation } = body;

    const validRoles = [UserRole.ADMIN, UserRole.GK_SIR, UserRole.HOD, UserRole.STUDENT];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { success: false, error: "Invalid role specified." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (newRole === UserRole.ADMIN && adminConfirmation !== "GRANT ADMIN ACCESS") {
      return NextResponse.json(
        { success: false, error: "Changing role to ADMIN requires exact confirmation 'GRANT ADMIN ACCESS'." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const targetUserAccess = await prisma.userAccess.findUnique({
      where: { id }
    });

    if (!targetUserAccess) {
      return NextResponse.json(
        { success: false, error: "Account not found." },
        { status: 404, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const oldRole = targetUserAccess.role;

    const updated = await prisma.userAccess.update({
      where: { id },
      data: { role: newRole }
    });

    await recordAuditEvent({
      actorUserId: adminSession.authUserId,
      action: AuditAction.ROLE_CHANGED,
      targetType: "UserAccess",
      targetId: id,
      metadata: {
        email: targetUserAccess.email,
        oldRole,
        newRole
      }
    });

    return NextResponse.json({
      success: true,
      message: `Role for ${targetUserAccess.email} changed from ${oldRole} to ${newRole}.`,
      data: {
        id: updated.id,
        email: updated.email,
        role: updated.role
      }
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in PATCH /api/admin/accounts/[id]/role:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
