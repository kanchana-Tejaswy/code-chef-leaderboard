import { NextRequest, NextResponse } from "next/server";
import { isPublicDemoWriteEnabled } from "@/lib/write-access";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    publicDemoWriteMode: isPublicDemoWriteEnabled(),
  });
}
