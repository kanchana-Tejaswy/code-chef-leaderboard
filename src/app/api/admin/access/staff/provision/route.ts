import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { provisionStaffAccount } from "@/services/auth-provisioning.service";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";
import { normalizeEmail } from "@/utils/normalization";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireAdmin();

    const body = await request.json();
    const { email, role, departmentId } = body;

    if (!email || !role) {
      return NextResponse.json({ success: false, error: "Email and role are required." }, { status: 400 });
    }

    if (role === UserRole.STUDENT) {
      return NextResponse.json({ success: false, error: "Cannot provision a STUDENT via staff provisioning." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json({ success: false, error: "Invalid email." }, { status: 400 });
    }

    await recordAuditEvent({
      actorUserId: adminSession.id,
      action: AuditAction.STAFF_PROVISION_REQUESTED,
      metadata: { email: normalizedEmail, role, departmentId }
    });

    const result = await provisionStaffAccount({
      email: normalizedEmail,
      role,
      departmentId,
      approvedBy: adminSession.authUserId || undefined,
    });

    // We do not leak internal Supabase errors; the provisionStaffAccount service returns safe strings
    return NextResponse.json({
      success: result.status === "CREATED" || result.status === "LINKED",
      result: result.status,
      message: result.message
    });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in staff provisioning API:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
