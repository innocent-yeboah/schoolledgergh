import { NextResponse } from "next/server";
import { readSmsEnv, smsIsLive } from "@/lib/sms/adapter";
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
  const provider = env.SMS_PROVIDER === "hubtel" || env.SMS_PROVIDER === "arkesel" ? env.SMS_PROVIDER : null;
  return NextResponse.json({
    configured: smsIsLive(env),
    provider,
    senderId: env.SMS_SENDER_ID || "SchoolGH",
  });
}
