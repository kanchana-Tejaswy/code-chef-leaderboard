import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { AccountStatus, UserRole } from "@prisma/client";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminSession = await requireAdmin();

    const { id } = await params;
    const body = await request.json();
    const { status: newStatus } = body;

    if (!newStatus || !Object.values(AccountStatus).includes(newStatus)) {
      return NextResponse.json({ success: false, error: "Invalid status requested." }, { status: 400 });
    }

    const targetAccount = await prisma.userAccess.findUnique({ where: { id } });
    if (!targetAccount) {
      return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
    }

    if (targetAccount.authUserId === adminSession.authUserId) {
      await recordAuditEvent({
        actorUserId: adminSession.authUserId,
        action: AuditAction.ACCOUNT_STATUS_CHANGE_REJECTED,
        targetType: "UserAccess",
        targetId: id,
        metadata: { reason: "Cannot change own status" }
      });
      return NextResponse.json({ success: false, error: "You cannot change your own account status." }, { status: 403 });
    }

    if (targetAccount.role === UserRole.ADMIN && (newStatus === AccountStatus.SUSPENDED || newStatus === AccountStatus.DISABLED)) {
      // Prevent disabling the last active admin
      const activeAdmins = await prisma.userAccess.count({
        where: {
          role: UserRole.ADMIN,
          status: { in: [AccountStatus.ACTIVE, AccountStatus.PENDING] },
        }
      });

      if (activeAdmins <= 1 && targetAccount.status !== AccountStatus.SUSPENDED && targetAccount.status !== AccountStatus.DISABLED) {
        await recordAuditEvent({
          actorUserId: adminSession.authUserId,
          action: AuditAction.ACCOUNT_STATUS_CHANGE_REJECTED,
          targetType: "UserAccess",
          targetId: id,
          metadata: { reason: "Cannot disable final active ADMIN" }
        });
        return NextResponse.json({ success: false, error: "Cannot suspend or disable the final active ADMIN account." }, { status: 403 });
      }
    }

    // Safe Transition Logic
    const currentStatus = targetAccount.status;
    let finalStatus = newStatus;

    if (newStatus === AccountStatus.SUSPENDED) {
      if (currentStatus !== AccountStatus.ACTIVE && currentStatus !== AccountStatus.PENDING) {
        return NextResponse.json({ success: false, error: "Only ACTIVE or PENDING accounts can be suspended." }, { status: 400 });
      }
    } else if (newStatus === AccountStatus.DISABLED) {
      if (currentStatus === AccountStatus.DISABLED) {
        return NextResponse.json({ success: false, error: "Account is already disabled." }, { status: 400 });
      }
    } else if (newStatus === "RESTORE") {
      finalStatus = (targetAccount.firstLoginCompleted && targetAccount.passwordSetAt) ? AccountStatus.ACTIVE : AccountStatus.PENDING;
      if (currentStatus === finalStatus) {
        return NextResponse.json({ success: false, error: "Account is already in the restored state." }, { status: 400 });
      }
    } else if (newStatus === AccountStatus.ACTIVE || newStatus === AccountStatus.PENDING) {
       return NextResponse.json({ success: false, error: "Please use 'RESTORE' action to reactivate accounts safely." }, { status: 400 });
    }

    // Transaction to prevent concurrent state conflict
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.userAccess.findUnique({ where: { id } });
      if (current?.status !== currentStatus) {
         throw new Error("Concurrent state change detected.");
      }
      return tx.userAccess.update({
        where: { id },
        data: { status: finalStatus }
      });
    });

    let action: string = AuditAction.ACCOUNT_SUSPENDED;
    if (finalStatus === AccountStatus.DISABLED) action = AuditAction.ACCOUNT_DISABLED;
    if (newStatus === "RESTORE") action = AuditAction.ACCOUNT_RESTORED;

    await recordAuditEvent({
      actorUserId: adminSession.authUserId,
      action,
      targetType: "UserAccess",
      targetId: id,
      metadata: { previousStatus: currentStatus, newStatus: finalStatus }
    });

    return NextResponse.json({ success: true, data: result });

  } catch (err: any) {
    if (err.message === "Concurrent state change detected.") {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    }
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in status API:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
