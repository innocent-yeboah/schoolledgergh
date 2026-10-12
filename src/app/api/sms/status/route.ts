import { NextResponse } from "next/server";
import { readSmsEnv, resolveSmsProvider, smsIsLive } from "@/lib/sms/adapter";
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
  const env = readSmsEnv();
  const paystack = readPaystackEnv();
  return NextResponse.json({
    configured: smsIsLive(env),
    provider: resolveSmsProvider(env),
    senderId: env.SMS_SENDER_ID || "SchoolGH",
    paystackMode: paystackMode(paystack),
  });
}
