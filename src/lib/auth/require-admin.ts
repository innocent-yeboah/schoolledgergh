import "server-only";
import { NextResponse } from "next/server";
import { platformAccess, type PlatformAccess } from "@/lib/auth/platform-admin";

export async function requirePlatformAdmin(): Promise<PlatformAccess | NextResponse> {
  const access = await platformAccess();
  if (!access.signedIn) {
    return NextResponse.json(
      { admin: false, serviceConfigured: access.serviceConfigured, error: "Sign in required." },
      { status: 401 },
    );
  }
  if (!access.admin) {
    return NextResponse.json(
      {
        admin: false,
        serviceConfigured: access.serviceConfigured,
        email: access.email,
        error: access.error || "This account is not a platform admin.",
      },
      { status: 403 },
    );
  }
  return access;
}
