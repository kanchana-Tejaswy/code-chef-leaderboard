import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

async function checkAdmin() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const role = (user.user_metadata?.role || "STUDENT").toUpperCase();
    return role === "ADMIN";
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Fetch recent 25 sync logs
    const logs = await prisma.syncLog.findMany({
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: {
            name: true,
            rollNumber: true,
          },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error("Error in admin logs API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
