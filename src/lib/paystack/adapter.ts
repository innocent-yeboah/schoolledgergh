import { cedisToPesewas, pesewasToCedis } from "@/lib/paystack/money";

export type PaystackEnv = {
  PAYSTACK_SECRET_KEY?: string;
  PAYSTACK_PUBLIC_KEY?: string;
  PAYSTACK_LIVE?: string;
};

export type PaystackMode = "missing" | "test" | "live" | "blocked";

export type PaystackLinkInput = {
  email: string;
  amountCedis: number;
  reference: string;
  callbackUrl: string;
  studentId: string;
  schoolId: string;
  studentName: string;
};

export type PaystackLinkResult =
  | { ok: true; stub: false; mode: "test" | "live"; url: string; reference: string }
  | { ok: false; stub: true; mode: "missing" | "blocked"; error: string }
  | { ok: false; stub: false; mode: "test" | "live"; error: string };

export type VerifiedCharge = {
  reference: string;
  amountCedis: number;
  currency: string;
  status: string;
  channel: string;
  studentId: string | null;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function readPaystackEnv(source: Record<string, string | undefined> = process.env): PaystackEnv {
  return {
    PAYSTACK_SECRET_KEY: source.PAYSTACK_SECRET_KEY,
    PAYSTACK_PUBLIC_KEY: source.PAYSTACK_PUBLIC_KEY,
    PAYSTACK_LIVE: source.PAYSTACK_LIVE,
  };
}

export function paystackMode(env: PaystackEnv): PaystackMode {
  const key = env.PAYSTACK_SECRET_KEY?.trim() ?? "";
  if (!key) return "missing";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_") && env.PAYSTACK_LIVE === "true") return "live";
  return "blocked";
}

export function paystackStubMessage(mode: "missing" | "blocked"): string {
  if (mode === "blocked") {
    return "Paystack is locked to test mode. Use an sk_test_ secret, or set PAYSTACK_LIVE=true before using an sk_live_ secret. Nothing was charged.";
  }
  return "Paystack is not configured. Set PAYSTACK_SECRET_KEY to an sk_test_ key. Nothing was charged.";
}

export async function initializePaymentLink(
  input: PaystackLinkInput,
  env: PaystackEnv = readPaystackEnv(),
  fetchImpl: FetchLike = fetch,
): Promise<PaystackLinkResult> {
  const mode = paystackMode(env);
  if (mode === "missing" || mode === "blocked") {
    return { ok: false, stub: true, mode, error: paystackStubMessage(mode) };
  }
  const secret = env.PAYSTACK_SECRET_KEY?.trim() ?? "";
  const amount = cedisToPesewas(input.amountCedis);
  if (!input.email.trim() || !input.reference.trim() || amount <= 0) {
    return { ok: false, stub: false, mode, error: "A parent or school email and a positive balance are required. Nothing was charged." };
  }

  try {
    const response = await fetchImpl("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email.trim(),
        amount: String(amount),
        currency: "GHS",
        channels: ["mobile_money"],
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: {
          student_id: input.studentId,
          school_id: input.schoolId,
          student_name: input.studentName,
        },
      }),
    });
    const body = await readJson(response);
    const url = nestedString(body, "authorization_url");
    const reference = nestedString(body, "reference") || input.reference;
    if (!response.ok || boolField(body, "status") === false || !url) {
      return { ok: false, stub: false, mode, error: textField(body, "message") ?? `Paystack returned ${response.status}. Nothing was charged.` };
    }
    return { ok: true, stub: false, mode, url, reference };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paystack could not be reached.";
    return { ok: false, stub: false, mode, error: `${message} Nothing was charged.` };
  }
}

export async function verifyPaystackTransaction(
  reference: string,
  env: PaystackEnv,
  fetchImpl: FetchLike = fetch,
): Promise<{ ok: true; charge: VerifiedCharge } | { ok: false; error: string }> {
  const secret = env.PAYSTACK_SECRET_KEY?.trim() ?? "";
  if (!secret) return { ok: false, error: "Paystack is not configured." };
  const response = await fetchImpl(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await readJson(response);
  const data = body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : null;
  if (!response.ok || boolField(body, "status") === false || !data || typeof data !== "object") {
    return { ok: false, error: textField(body, "message") ?? `Paystack verify returned ${response.status}.` };
  }
  const record = data as Record<string, unknown>;
  const amount = typeof record.amount === "number" ? record.amount : Number.NaN;
  return {
    ok: true,
    charge: {
      reference: typeof record.reference === "string" ? record.reference : reference,
      amountCedis: Number.isFinite(amount) ? pesewasToCedis(amount) : Number.NaN,
      currency: typeof record.currency === "string" ? record.currency : "",
      status: typeof record.status === "string" ? record.status : "",
      channel: typeof record.channel === "string" ? record.channel : "",
      studentId: metadataStudentId(record.metadata),
    },
  };
}

export function metadataStudentId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { student_id?: unknown }).student_id;
  return typeof value === "string" && value.trim() ? value : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function textField(body: unknown, key: string): string | null {
  if (!body || typeof body !== "object" || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

function boolField(body: unknown, key: string): boolean | null {
  if (!body || typeof body !== "object" || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function nestedString(body: unknown, key: string): string | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !(key in data)) return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}
