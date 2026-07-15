import { NextRequest, NextResponse } from "next/server";
import { getPublicDemoWriteModeStatus } from "@/lib/write-access";

export async function GET(request: NextRequest) {
  return NextResponse.json(getPublicDemoWriteModeStatus());
}
