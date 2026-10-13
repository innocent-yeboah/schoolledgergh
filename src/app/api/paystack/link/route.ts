import { NextResponse } from "next/server";
import { studentName } from "@/lib/domain";
import { paymentLinkForStudent } from "@/lib/paystack/issue";
import { paystackMode, readPaystackEnv } from "@/lib/paystack/adapter";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }
  const env = readPaystackEnv();
  const mode = paystackMode(env);
  return NextResponse.json({
    mode,
    publicKeySet: Boolean(env.PAYSTACK_PUBLIC_KEY?.trim()),
  });
}

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase is not configured." }, { status: 503 });
  }
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  if (!studentId) return NextResponse.json({ error: "Choose a student. Nothing was charged." }, { status: 400 });

  const schoolResult = await supabase.from("schools").select("id, email").eq("user_id", auth.user.id).maybeSingle();
  if (schoolResult.error) return NextResponse.json({ error: schoolResult.error.message }, { status: 500 });
  if (!schoolResult.data) return NextResponse.json({ error: "Create your school before creating a payment link." }, { status: 400 });

  const studentResult = await supabase
    .from("students")
    .select("id, first_name, last_name, parent_email, term_fee")
    .eq("id", studentId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (studentResult.error) return NextResponse.json({ error: studentResult.error.message }, { status: 500 });
  if (!studentResult.data) return NextResponse.json({ error: "That student is not on your roll." }, { status: 404 });

  const paymentResult = await supabase.from("payments").select("amount").eq("student_id", studentId).eq("user_id", auth.user.id);
  if (paymentResult.error) return NextResponse.json({ error: paymentResult.error.message }, { status: 500 });
  const paid = (paymentResult.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const balance = Number(studentResult.data.term_fee) - paid;
  const origin = new URL(request.url).origin;
  const issued = await paymentLinkForStudent(supabase, {
    schoolId: schoolResult.data.id,
    userId: auth.user.id,
    schoolEmail: schoolResult.data.email ?? "",
    studentId,
    studentName: studentName({ firstName: studentResult.data.first_name, lastName: studentResult.data.last_name }),
    parentEmail: studentResult.data.parent_email ?? "",
    balance,
    origin,
  });

  const url = issued.text.startsWith("https://") ? issued.text : null;
  if (!url) {
    return NextResponse.json(
      { stub: issued.stub, url: null, error: issued.warning || issued.text, reference: null },
      { status: issued.stub ? 200 : 400 },
    );
  }
  return NextResponse.json({ stub: false, url, reference: issued.reference, error: issued.warning });
}
