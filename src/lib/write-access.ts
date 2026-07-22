import { NextRequest } from "next/server";

export function isPublicDemoWriteEnabled(): boolean {
  return process.env.ALLOW_PUBLIC_DEMO_WRITES === "true" && process.env.NODE_ENV !== "production";
}

export function isPublicDemoDeleteEnabled(): boolean {
  return process.env.ALLOW_PUBLIC_DEMO_WRITES === "true" && process.env.NODE_ENV !== "production";
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

export function canPerformWrite(request?: NextRequest): boolean {
  return isPublicDemoWriteEnabled();
}

export function canPerformDelete(request?: NextRequest): boolean {
  return isPublicDemoDeleteEnabled();
}

export function getPublicDemoModeStatus() {
  const enabled = isPublicDemoWriteEnabled();
  return {
    publicDemoWriteMode: enabled,
    publicDemoDeleteMode: enabled,
    publicDemoModeActive: enabled,
  };
}

