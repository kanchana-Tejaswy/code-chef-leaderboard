import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await requireAdmin();
    const { id } = await params;

    const targetAccount = await prisma.userAccess.findUnique({
      where: { id }
    });

    if (!targetAccount) {
      return NextResponse.json(
        { success: false, error: "Account not found." },
        { status: 404, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const email = targetAccount.email;
    const supabaseAdmin = createAdminClient();

    // Generate password recovery link / reset email via Supabase Auth
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (resetError) {
      console.error("Password reset error for email:", email, resetError);
      return NextResponse.json(
        { success: false, error: "Failed to send password reset email. Please try again." },
        { status: 500, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    await recordAuditEvent({
      actorUserId: adminSession.id,
      action: AuditAction.PASSWORD_RESET_SENT,
      targetType: "UserAccess",
      targetId: id,
      metadata: { email }
    });

    return NextResponse.json({
      success: true,
      message: "Password reset email sent successfully."
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in POST /api/admin/accounts/[id]/password-reset:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
