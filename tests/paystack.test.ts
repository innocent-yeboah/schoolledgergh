import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { initializePaymentLink } from "@/lib/paystack/adapter";
import { cedisToPesewas, pesewasToCedis } from "@/lib/paystack/money";
import { decideSettlement } from "@/lib/paystack/settle";
import { handlePaystackWebhook } from "@/lib/paystack/webhook";
import { personaliseReminder } from "@/lib/sms/reminders";

const linkInput = {
  email: "yaa@example.com",
  amountCedis: 250,
  reference: "slgh.test",
  callbackUrl: "https://school.example/app/fees?student=S1",
  studentId: "S1",
  schoolId: "school",
  studentName: "Ama Owusu",
};

describe("Paystack links", () => {
  it("converts cedis to pesewas", () => {
    expect(cedisToPesewas(250)).toBe(25000);
    expect(pesewasToCedis(25000)).toBe(250);
  });

  it("stays a stub and does not call Paystack when the secret is missing", async () => {
    const fetchImpl = vi.fn();
    const result = await initializePaymentLink(linkInput, {}, fetchImpl);
    expect(result).toMatchObject({ ok: false, stub: true, mode: "missing" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a live secret unless live mode is explicit", async () => {
    const fetchImpl = vi.fn();
    const result = await initializePaymentLink(linkInput, { PAYSTACK_SECRET_KEY: "sk_live_secret" }, fetchImpl);
    expect(result).toMatchObject({ ok: false, stub: true, mode: "blocked" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("creates a GHS mobile-money checkout with a test secret", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { currency: string; channels: string[]; amount: string; metadata: { student_id: string } };
      expect(body.currency).toBe("GHS");
      expect(body.channels).toEqual(["mobile_money"]);
      expect(body.amount).toBe("25000");
      expect(body.metadata.student_id).toBe("S1");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer sk_test_secret");
      return new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.com/abc", reference: "slgh.test" } }), { status: 200 });
    });
    const result = await initializePaymentLink(linkInput, { PAYSTACK_SECRET_KEY: "sk_test_secret" }, fetchImpl);
    expect(result).toMatchObject({ ok: true, stub: false, mode: "test", url: "https://checkout.paystack.com/abc", reference: "slgh.test" });
    expect(JSON.stringify(result)).not.toContain("sk_test_secret");
  });
});

describe("Paystack webhook", () => {
  const secret = "sk_test_secret";
  const rawBody = JSON.stringify({ event: "charge.success", data: { reference: "slgh.test" } });
  const signature = createHmac("sha512", secret).update(rawBody).digest("hex");

  it("rejects a bad signature before recording", async () => {
    const record = vi.fn();
    const outcome = await handlePaystackWebhook({
      rawBody,
      signature: "not-the-signature",
      env: { PAYSTACK_SECRET_KEY: secret },
      record,
    });
    expect(outcome.status).toBe(401);
    expect(record).not.toHaveBeenCalled();
  });

  it("verifies the charge with Paystack and records it once", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("/transaction/verify/slgh.test");
      return new Response(JSON.stringify({
        status: true,
        data: {
          reference: "slgh.test",
          amount: 25000,
          currency: "GHS",
          status: "success",
          channel: "mobile_money",
          metadata: { student_id: "S1" },
        },
      }), { status: 200 });
    });
    let seen: { reference?: string; amountCedis?: number; currency?: string; channel?: string; studentId?: string | null } | null = null;
    const record = vi.fn(async (charge: { reference: string; amountCedis: number; currency: string; channel: string; studentId: string | null }) => {
      seen = charge;
      return "recorded" as const;
    });
    const outcome = await handlePaystackWebhook({
      rawBody,
      signature,
      env: { PAYSTACK_SECRET_KEY: secret },
      fetchImpl,
      record,
    });
    expect(outcome).toMatchObject({ status: 200, body: { result: "recorded" } });
    expect(record).toHaveBeenCalledOnce();
    expect(seen).toMatchObject({ reference: "slgh.test", amountCedis: 250, currency: "GHS", channel: "mobile_money", studentId: "S1" });

    const repeat = await handlePaystackWebhook({
      rawBody,
      signature,
      env: { PAYSTACK_SECRET_KEY: secret },
      fetchImpl,
      record: async () => "duplicate",
    });
    expect(repeat.body.result).toBe("duplicate");
  });

  it("ignores a student mismatch and treats an existing reference as a duplicate", () => {
    const mismatch = decideSettlement({
      reference: "slgh.test",
      amountCedis: 250,
      currency: "GHS",
      status: "success",
      channel: "mobile_money",
      metadataStudentId: "OTHER",
      link: { studentId: "S1", schoolId: "school", amount: 250, status: "pending" },
      existingPayment: false,
      outstanding: 250,
    });
    expect(mismatch).toMatchObject({ action: "ignore" });

    const duplicate = decideSettlement({
      reference: "slgh.test",
      amountCedis: 250,
      currency: "GHS",
      status: "success",
      channel: "mobile_money",
      metadataStudentId: "S1",
      link: { studentId: "S1", schoolId: "school", amount: 250, status: "paid" },
      existingPayment: true,
      outstanding: 0,
    });
    expect(duplicate.action).toBe("duplicate");
  });
});

describe("personalised reminders", () => {
  it("keeps each parent's balance and payment link separate", () => {
    const template = "Dear {parent_name}, {student_name} owes GH₵{balance}. {payment_link}";
    const ama = personaliseReminder(template, {
      parent_name: "Yaa",
      student_name: "Ama Owusu",
      balance: "250.00",
      payment_link: "https://checkout.paystack.com/ama",
    });
    const kofi = personaliseReminder(template, {
      parent_name: "Efua",
      student_name: "Kofi Asare",
      balance: "500.00",
      payment_link: "https://checkout.paystack.com/kofi",
    });
    expect(ama).toContain("GH₵250.00");
    expect(ama).toContain("https://checkout.paystack.com/ama");
    expect(ama).not.toContain("Kofi");
    expect(kofi).toContain("https://checkout.paystack.com/kofi");
    expect(kofi).not.toContain("Ama");
  });
});
