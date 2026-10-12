import { NextResponse } from "next/server";
import { createId } from "@/lib/format";
import { studentName } from "@/lib/domain";
import { handlePaystackWebhook } from "@/lib/paystack/webhook";
import { accraPaidOn } from "@/lib/paystack/money";
import { decideSettlement } from "@/lib/paystack/settle";
import { readPaystackEnv, type VerifiedCharge } from "@/lib/paystack/adapter";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const outcome = await handlePaystackWebhook({
    rawBody,
    signature: request.headers.get("x-paystack-signature"),
    env: readPaystackEnv(),
    record: recordVerifiedCharge,
  });
  return NextResponse.json(outcome.body, { status: outcome.status });
}

async function recordVerifiedCharge(charge: VerifiedCharge): Promise<"recorded" | "duplicate" | "ignored"> {
  const service = createServiceClient();
  if (!service) throw new Error("Supabase service role is not configured.");

  const linkResult = await service
    .from("payment_links")
    .select("school_id, user_id, student_id, amount, status")
    .eq("reference", charge.reference)
    .maybeSingle();
  if (linkResult.error) throw new Error(linkResult.error.message);

  const link = linkResult.data;
  const studentResult = link
    ? await service
        .from("students")
        .select("id, first_name, last_name, class_name, term_fee")
        .eq("id", link.student_id)
        .eq("school_id", link.school_id)
        .maybeSingle()
    : { data: null, error: null };
  if (studentResult.error) throw new Error(studentResult.error.message);

  const paidResult = link
    ? await service.from("payments").select("id, amount, txn_id").eq("student_id", link.student_id).eq("school_id", link.school_id)
    : { data: [], error: null };
  if (paidResult.error) throw new Error(paidResult.error.message);

  const rows = paidResult.data ?? [];
  const existingPayment = rows.some((row) => row.txn_id === charge.reference);
  const paid = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const outstanding = studentResult.data ? Number(studentResult.data.term_fee) - paid : 0;
  const decision = decideSettlement({
    reference: charge.reference,
    amountCedis: charge.amountCedis,
    currency: charge.currency,
    status: charge.status,
    channel: charge.channel,
    metadataStudentId: charge.studentId,
    link: link
      ? {
          studentId: link.student_id,
          schoolId: link.school_id,
          amount: Number(link.amount),
          status: link.status === "paid" ? "paid" : "pending",
        }
      : null,
    existingPayment,
    outstanding,
  });

  if (decision.action === "ignore") return "ignored";
  if (decision.action === "duplicate") {
    if (link) await service.from("payment_links").update({ status: "paid" }).eq("reference", charge.reference);
    return "duplicate";
  }
  if (!link || !studentResult.data) return "ignored";

  const inserted = await service.from("payments").insert({
    id: createId("P"),
    school_id: link.school_id,
    user_id: link.user_id,
    student_id: link.student_id,
    student_name: studentName({ firstName: studentResult.data.first_name, lastName: studentResult.data.last_name }),
    class_name: studentResult.data.class_name,
    amount: decision.amount,
    method: decision.method,
    paid_on: accraPaidOn(),
    txn_id: charge.reference,
    notes: "Recorded from the verified Paystack webhook.",
  });
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      await service.from("payment_links").update({ status: "paid" }).eq("reference", charge.reference);
      return "duplicate";
    }
    if (/outstanding|exceeds/i.test(inserted.error.message)) return "ignored";
    throw new Error(inserted.error.message);
  }
  const marked = await service.from("payment_links").update({ status: "paid" }).eq("reference", charge.reference);
  if (marked.error) throw new Error(marked.error.message);
  return "recorded";
}
