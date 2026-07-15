import { NextRequest } from "next/server";

export function isPublicDemoWriteEnabled(): boolean {
  return process.env.PUBLIC_DEMO_WRITE_MODE === "true";
}

export function isPublicDemoDeleteEnabled(): boolean {
  return process.env.PUBLIC_DEMO_DELETE_MODE === "true";
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
  return isPublicDemoWriteEnabled() || hasValidCronSecret(request);
}

export function canPerformDelete(request: NextRequest): boolean {
  return isPublicDemoDeleteEnabled() || hasValidCronSecret(request);
}

export function getPublicDemoModeStatus() {
  return {
    publicDemoWriteMode: isPublicDemoWriteEnabled(),
    publicDemoDeleteMode: isPublicDemoDeleteEnabled(),
  };
}
