import {
  paystackMode,
  verifyPaystackTransaction,
  type PaystackEnv,
  type VerifiedCharge,
} from "@/lib/paystack/adapter";
import { verifyPaystackSignature } from "@/lib/paystack/signature";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type WebhookOutcome = {
  status: number;
  body: { ok: boolean; result: "recorded" | "duplicate" | "ignored" | "rejected" | "retry"; reason?: string };
};

export async function handlePaystackWebhook(input: {
  rawBody: string;
  signature: string | null;
  env: PaystackEnv;
  fetchImpl?: FetchLike;
  record: (charge: VerifiedCharge) => Promise<"recorded" | "duplicate" | "ignored">;
}): Promise<WebhookOutcome> {
  const mode = paystackMode(input.env);
  if (mode === "missing" || mode === "blocked") {
    return { status: 503, body: { ok: false, result: "rejected", reason: "Paystack is not ready to record charges." } };
  }
  const secret = input.env.PAYSTACK_SECRET_KEY?.trim() ?? "";
  if (!verifyPaystackSignature(input.rawBody, input.signature, secret)) {
    return { status: 401, body: { ok: false, result: "rejected", reason: "Invalid Paystack signature." } };
  }

  let eventName = "";
  let reference = "";
  try {
    const parsed = JSON.parse(input.rawBody) as { event?: unknown; data?: { reference?: unknown } };
    eventName = typeof parsed.event === "string" ? parsed.event : "";
    reference = typeof parsed.data?.reference === "string" ? parsed.data.reference : "";
  } catch {
    return { status: 400, body: { ok: false, result: "rejected", reason: "Webhook body is not JSON." } };
  }
  if (eventName !== "charge.success") {
    return { status: 200, body: { ok: true, result: "ignored", reason: "Event is not a successful charge." } };
  }
  if (!reference) {
    return { status: 200, body: { ok: true, result: "ignored", reason: "Charge has no reference." } };
  }

  let verified;
  try {
    verified = await verifyPaystackTransaction(reference, input.env, input.fetchImpl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Paystack verify failed.";
    return { status: 503, body: { ok: false, result: "retry", reason } };
  }
  if (!verified.ok) {
    return { status: 503, body: { ok: false, result: "retry", reason: verified.error } };
  }

  try {
    const result = await input.record(verified.charge);
    if (result === "recorded") return { status: 200, body: { ok: true, result: "recorded" } };
    if (result === "duplicate") return { status: 200, body: { ok: true, result: "duplicate" } };
    return { status: 200, body: { ok: true, result: "ignored" } };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The payment could not be saved.";
    return { status: 500, body: { ok: false, result: "retry", reason } };
  }
}
