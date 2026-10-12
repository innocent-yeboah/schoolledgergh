import { NextResponse } from "next/server";
import { platformAccess } from "@/lib/auth/platform-admin";
import { createServiceClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await platformAccess();
  if (!access.signedIn) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!access.admin) return NextResponse.json({ error: "This account is not a platform admin." }, { status: 403 });
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "The server secret key is not configured, so the school was not deleted." }, { status: 503 });
  }
  const { id } = await context.params;
  const school = await service.from("schools").select("user_id, name").eq("id", id).maybeSingle();
  if (school.error) return NextResponse.json({ error: school.error.message }, { status: 500 });
  if (!school.data) return NextResponse.json({ error: "School not found." }, { status: 404 });
  const removed = await service.auth.admin.deleteUser(school.data.user_id);
  if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, name: school.data.name });
}
