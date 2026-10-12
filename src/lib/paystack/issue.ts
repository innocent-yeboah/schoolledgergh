import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYMENT_LINK_PLACEHOLDER } from "@/lib/domain";
import {
  initializePaymentLink,
  paystackMode,
  paystackStubMessage,
  readPaystackEnv,
  type PaystackEnv,
} from "@/lib/paystack/adapter";
import { createPaystackReference, receiptEmail } from "@/lib/paystack/reference";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type IssuedLink = {
  text: string;
  stub: boolean;
  warning: string | null;
  reference: string | null;
};

export async function paymentLinkForStudent(
  supabase: SupabaseClient,
  input: {
    schoolId: string;
    userId: string;
    schoolEmail: string;
    studentId: string;
    studentName: string;
    parentEmail: string;
    balance: number;
    origin: string;
  },
  env: PaystackEnv = readPaystackEnv(),
  fetchImpl?: FetchLike,
): Promise<IssuedLink> {
  if (input.balance <= 0.001) {
    return { text: "No balance due.", stub: false, warning: null, reference: null };
  }

  const mode = paystackMode(env);
  if (mode === "missing" || mode === "blocked") {
    return { text: PAYMENT_LINK_PLACEHOLDER, stub: true, warning: paystackStubMessage(mode), reference: null };
  }

  const pending = await supabase
    .from("payment_links")
    .select("reference, authorization_url, amount")
    .eq("student_id", input.studentId)
    .eq("user_id", input.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);
  if (pending.error) {
    return { text: PAYMENT_LINK_PLACEHOLDER, stub: false, warning: pending.error.message, reference: null };
  }
  const existing = (pending.data ?? []).find((row) => {
    const amount = Number(row.amount);
    return row.authorization_url && Math.abs(amount - input.balance) <= 0.001;
  });
  if (existing?.authorization_url) {
    return { text: existing.authorization_url, stub: false, warning: null, reference: existing.reference };
  }

  const email = receiptEmail(input.parentEmail, input.schoolEmail);
  if (!email) {
    return {
      text: PAYMENT_LINK_PLACEHOLDER,
      stub: false,
      warning: `${input.studentName} needs a parent or school email before a Paystack link can be created.`,
      reference: null,
    };
  }

  const reference = createPaystackReference();
  const created = await initializePaymentLink(
    {
      email,
      amountCedis: input.balance,
      reference,
      callbackUrl: `${input.origin}/app/fees?student=${encodeURIComponent(input.studentId)}`,
      studentId: input.studentId,
      schoolId: input.schoolId,
      studentName: input.studentName,
    },
    env,
    fetchImpl,
  );
  if (!created.ok) {
    return { text: PAYMENT_LINK_PLACEHOLDER, stub: created.stub, warning: created.error, reference: null };
  }

  const inserted = await supabase.from("payment_links").insert({
    school_id: input.schoolId,
    user_id: input.userId,
    student_id: input.studentId,
    reference: created.reference,
    amount: input.balance,
    authorization_url: created.url,
    status: "pending",
  });
  if (inserted.error) {
    return { text: PAYMENT_LINK_PLACEHOLDER, stub: false, warning: inserted.error.message, reference: null };
  }
  return { text: created.url, stub: false, warning: null, reference: created.reference };
}
