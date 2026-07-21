import { NextRequest } from "next/server";
import { getAuthenticatedUserAccess } from "./auth";
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

export async function canPerformWrite(request: NextRequest): Promise<boolean> {
  const userAccess = await getAuthenticatedUserAccess();
  if (userAccess && (userAccess.role === "ADMIN" || userAccess.role === "GK_SIR")) {
    return true;
  }
  return false;
}

export async function canPerformDelete(request: NextRequest): Promise<boolean> {
  const userAccess = await getAuthenticatedUserAccess();
  if (userAccess && (userAccess.role === "ADMIN" || userAccess.role === "GK_SIR")) {
    return true;
  }
  return false;
}

export function getPublicDemoModeStatus() {
  return {
    publicDemoWriteMode: true,
    publicDemoDeleteMode: true,
  };
}
