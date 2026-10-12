import { NextResponse } from "next/server";
import { studentName } from "@/lib/domain";
import { paymentLinkForStudent } from "@/lib/paystack/issue";
import { deliverSms } from "@/lib/sms/deliver";
import { SMS_MAX_LENGTH } from "@/lib/sms/reminders";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
  const message = String(body?.message ?? "");
  const audience = body?.audience === "owing" ? "owing" : "selected";
  const studentIds = Array.isArray(body?.studentIds) ? body.studentIds.filter((id: unknown) => typeof id === "string").slice(0, 300) : [];
  if (!message.trim()) return NextResponse.json({ error: "Write an SMS message first. Nothing was sent." }, { status: 400 });
  if (message.length > SMS_MAX_LENGTH) {
    return NextResponse.json({ error: `SMS messages are limited to ${SMS_MAX_LENGTH} characters. Nothing was sent.` }, { status: 400 });
  }
  if (audience === "selected" && !studentIds.length) {
    return NextResponse.json({ error: "Choose at least one student. Nothing was sent." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "SMS logging is not configured. Set the server secret key. Nothing was sent." },
      { status: 503 },
    );
  }

  const schoolResult = await supabase.from("schools").select("id, name, phone, email, term, academic_year").eq("user_id", auth.user.id).maybeSingle();
  if (schoolResult.error) return NextResponse.json({ error: schoolResult.error.message }, { status: 500 });
  if (!schoolResult.data) return NextResponse.json({ error: "Create your school before sending SMS." }, { status: 400 });

  const studentQuery = supabase
    .from("students")
    .select("id, first_name, last_name, parent_name, parent_phone, parent_email, term_fee, class_name")
    .eq("user_id", auth.user.id);
  const studentResult = audience === "owing" ? await studentQuery.limit(300) : await studentQuery.in("id", studentIds);
  if (studentResult.error) return NextResponse.json({ error: studentResult.error.message }, { status: 500 });

  const paymentQuery = supabase.from("payments").select("student_id, amount").eq("user_id", auth.user.id);
  const paymentResult = audience === "owing" ? await paymentQuery.limit(2000) : await paymentQuery.in("student_id", studentIds);
  if (paymentResult.error) return NextResponse.json({ error: paymentResult.error.message }, { status: 500 });

  const paid = new Map<string, number>();
  for (const payment of (paymentResult.data ?? []) as { student_id: string | null; amount: number | string }[]) {
    if (!payment.student_id) continue;
    paid.set(payment.student_id, (paid.get(payment.student_id) ?? 0) + Number(payment.amount));
  }

  const school = schoolResult.data;
  const origin = new URL(request.url).origin;
  const logWarnings: string[] = [];
  const linkWarnings = new Set<string>();
  const students = ((studentResult.data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    parent_name: string;
    parent_phone: string;
    parent_email: string;
    term_fee: number | string;
    class_name: string;
  }[]).map((student) => {
    const amountPaid = paid.get(student.id) ?? 0;
    const balance = Number(student.term_fee) - amountPaid;
    return { student, balance };
  }).filter((row) => audience !== "owing" || row.balance > 0.001);

  if (!students.length) {
    return NextResponse.json({ error: "No owing parents to text. Nothing was sent.", sent: 0, failed: 0, skipped: 0 }, { status: 400 });
  }

  const recipients = [];
  for (const { student, balance } of students) {
    const name = studentName({ firstName: student.first_name, lastName: student.last_name });
    const link = await paymentLinkForStudent(supabase, {
      schoolId: school.id,
      userId: auth.user.id,
      schoolEmail: school.email ?? "",
      studentId: student.id,
      studentName: name,
      parentEmail: student.parent_email ?? "",
      balance,
      origin,
    });
    if (link.warning) linkWarnings.add(link.warning);
    recipients.push({
      id: student.id,
      parentName: student.parent_name,
      parentPhone: student.parent_phone,
      label: name,
      vars: {
        parent_name: student.parent_name,
        student_name: name,
        student_id: student.id,
        balance: Math.max(balance, 0).toFixed(2),
        term: school.term,
        academic_year: school.academic_year,
        school_name: school.name,
        school_phone: school.phone,
        class_name: student.class_name,
        payment_link: link.text,
      },
    });
  }

  const summary = await deliverSms({
    recipients,
    message,
    senderId: process.env.SMS_SENDER_ID || "SchoolGH",
    log: async (entry) => {
      const { error } = await service.from("message_log").insert({
        school_id: school.id,
        user_id: auth.user.id,
        channel: "sms",
        message_type: "sms",
        recipient: entry.recipient,
        student_label: entry.studentLabel,
        txn_id: entry.txnId,
        status: entry.status,
      });
      if (error) logWarnings.push(error.message);
    },
  });

  const status = summary.sent > 0 ? 200 : 400;
  return NextResponse.json(
    {
      ...summary,
      logWarnings,
      linkWarnings: [...linkWarnings],
      error: summary.errors[0] ?? logWarnings[0] ?? null,
    },
    { status },
  );
}
