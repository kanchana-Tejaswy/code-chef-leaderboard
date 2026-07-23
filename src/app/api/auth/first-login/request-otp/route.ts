import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, message: "First-login OTP authentication is disabled." },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET() {
  return NextResponse.json(
    { success: false, message: "Method not allowed" },
    { status: 405, headers: { "Cache-Control": "no-store" } }
  );
}
