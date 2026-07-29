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
        { success: false, error: "UserAccess record not found." },
        { status: 404, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const email = targetAccount.email;
    const supabaseAdmin = createAdminClient();

    // 1. Check if Supabase Auth user exists
    let authUserId = targetAccount.authUserId;
    if (!authUserId) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const match = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (match) {
        authUserId = match.id;
      }
    }

    // 2. If Auth user does not exist in Supabase Auth, create Auth user
    if (!authUserId) {
      const tempPassword = "AceTempPass#" + Math.random().toString(36).slice(-8) + "2026!";
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true
      });
      if (createError || !createData?.user) {
        return NextResponse.json(
          { success: false, error: `Failed to create Supabase Auth user: ${createError?.message}` },
          { status: 500, headers: { "Cache-Control": "private, no-store" } }
        );
      }
      authUserId = createData.user.id;
    }

    // 3. Link authUserId to UserAccess
    const updated = await prisma.userAccess.update({
      where: { id },
      data: {
        authUserId,
        mustSetPassword: true
      }
    });

    await recordAuditEvent({
      actorUserId: adminSession.id,
      action: AuditAction.ACCOUNT_REPAIRED,
      targetType: "UserAccess",
      targetId: id,
      metadata: { email, authUserId }
    });

    return NextResponse.json({
      success: true,
      message: `Account link successfully repaired for ${email}.`,
      data: {
        id: updated.id,
        email: updated.email,
        authUserId: updated.authUserId
      }
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in POST /api/admin/accounts/[id]/repair:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
