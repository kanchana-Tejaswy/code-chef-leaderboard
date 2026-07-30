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

import { getAuthenticatedUserAccess } from "./auth";

export async function canPerformWrite(request?: NextRequest): Promise<boolean> {
  try {
    const access = await getAuthenticatedUserAccess();
    if (access && access.role === "ADMIN" && access.status === "ACTIVE") {
      return true;
    }
  } catch (err) {
    // Auth checks error
  }
  return isPublicDemoWriteEnabled();
}

export async function canPerformDelete(request?: NextRequest): Promise<boolean> {
  try {
    const access = await getAuthenticatedUserAccess();
    if (access && access.role === "ADMIN" && access.status === "ACTIVE") {
      return true;
    }
  } catch (err) {
    // Auth checks error
  }
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

