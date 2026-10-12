import { NextResponse } from "next/server";
import { platformAccess } from "@/lib/auth/platform-admin";

export async function GET() {
  const access = await platformAccess();
  if (!access.signedIn) return NextResponse.json({ admin: false, serviceConfigured: access.serviceConfigured }, { status: 401 });
  return NextResponse.json({
    admin: access.admin,
    serviceConfigured: access.serviceConfigured,
    email: access.email,
    error: access.error ?? null,
  });
}
