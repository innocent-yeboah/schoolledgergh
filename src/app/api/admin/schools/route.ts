import { NextResponse } from "next/server";
import { summarizeSchools, type SchoolRow } from "@/lib/admin/summary";
import { platformAccess } from "@/lib/auth/platform-admin";
import { defaultClassFees, DEFAULT_FEEDING_FEE, DEFAULT_TPL_PAYMENT, DEFAULT_TPL_REMINDER } from "@/lib/domain";
import { createServiceClient } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const service = gate;
  const [schools, students, payments] = await Promise.all([
    service.from("schools").select("id, user_id, name, admin_name, phone, email, address, term, academic_year, created_at").order("name"),
    service.from("students").select("school_id"),
    service.from("payments").select("school_id, amount"),
  ]);
  const failure = schools.error || students.error || payments.error;
  if (failure) return NextResponse.json({ error: failure.message }, { status: 500 });
  return NextResponse.json({
    schools: summarizeSchools(
      (schools.data ?? []) as SchoolRow[],
      (students.data ?? []) as { school_id: string }[],
      (payments.data ?? []) as { school_id: string; amount: number }[],
    ),
  });
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const service = gate;
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const adminName = String(body?.adminName ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const address = String(body?.address ?? "").trim();
  const term = String(body?.term ?? "").trim();
  const academicYear = String(body?.academicYear ?? "").trim();
  if (!name || !email || !term || !academicYear) {
    return NextResponse.json({ error: "School name, email, term, and academic year are required." }, { status: 400 });
  }
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: adminName, phone },
  });
  if (created.error || !created.data.user) {
    return NextResponse.json({ error: created.error?.message ?? "The school login could not be created." }, { status: 400 });
  }

  const inserted = await service.from("schools").insert({
    user_id: created.data.user.id,
    name,
    admin_name: adminName,
    phone,
    email,
    address,
    term,
    academic_year: academicYear,
    feeding_fee: DEFAULT_FEEDING_FEE,
    class_fees: defaultClassFees(),
    tpl_payment: DEFAULT_TPL_PAYMENT,
    tpl_reminder: DEFAULT_TPL_REMINDER,
  }).select("id").single();

  if (inserted.error) {
    await service.auth.admin.deleteUser(created.data.user.id);
    return NextResponse.json({ error: `The login was not kept because the school record failed: ${inserted.error.message}` }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.data.id, email, name });
}

async function requireAdmin() {
  const access = await platformAccess();
  if (!access.signedIn) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!access.admin) return NextResponse.json({ error: "This account is not a platform admin." }, { status: 403 });
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "Platform admin cannot use the public anon key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY on the server." },
      { status: 503 },
    );
  }
  return service;
}
