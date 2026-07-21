import { NextRequest } from "next/server";

export function isPublicDemoWriteEnabled(): boolean {
  return true;
}

export function isPublicDemoDeleteEnabled(): boolean {
  return true;
}

export function hasValidCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    return false;
  }

  const normalizedHeader = authHeader.trim();
  if (!normalizedHeader.toLowerCase().startsWith("bearer ")) {
    return false;
  }

  const suppliedToken = normalizedHeader.slice("Bearer ".length).trim();
  
  // Use a simple constant-time comparison or direct comparison
  return suppliedToken === cronSecret;
}

export function canPerformWrite(request: NextRequest): boolean {
  return true;
}

export function canPerformDelete(request: NextRequest): boolean {
  return true;
}

export function getPublicDemoModeStatus() {
  return {
    publicDemoWriteMode: true,
    publicDemoDeleteMode: true,
  };
}
