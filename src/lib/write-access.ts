import { NextRequest } from "next/server";

export function isPublicDemoWriteEnabled(): boolean {
  return process.env.PUBLIC_DEMO_WRITE_MODE === "true";
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
  return suppliedToken === cronSecret;
}

export function canPerformWrite(request: NextRequest): boolean {
  return isPublicDemoWriteEnabled() || hasValidCronSecret(request);
}

export function getPublicDemoWriteModeStatus() {
  return {
    publicDemoWriteMode: isPublicDemoWriteEnabled(),
  };
}
