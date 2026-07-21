import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Determine target ID before signing out, to log correctly
    let auditTargetId: string | undefined;

    if (user) {
      const targetUserAccess = await prisma.userAccess.findUnique({
        where: { authUserId: user.id },
      });
      if (targetUserAccess) {
        auditTargetId = targetUserAccess.id;
      }
    }

    // Sign out from Supabase (clears the session cookie via SSR)
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error("[Logout Error from Supabase]:", error);
      // Even if it failed remotely, we try to return success so the client clears its state
    }

    if (auditTargetId) {
      await recordAuditEvent({
        action: AuditAction.SESSION_LOGOUT,
        targetId: auditTargetId,
      });
    }

    return NextResponse.json({ success: true, message: "Logged out successfully" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Logout Error]:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
