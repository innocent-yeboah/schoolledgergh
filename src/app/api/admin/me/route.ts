import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  const access = await requirePlatformAdmin();
  if (access instanceof NextResponse) return access;
  return NextResponse.json({
    admin: true,
    serviceConfigured: access.serviceConfigured,
    email: access.email,
    error: access.error ?? null,
  });
}
