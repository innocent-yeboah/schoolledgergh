import { describe, expect, it, vi } from "vitest";
import { sendSms } from "@/lib/sms/adapter";
import { deliverSms, type SmsLogEntry } from "@/lib/sms/deliver";

describe("SMS adapter", () => {
  it("does not send or pretend success when the key or live flag is missing", async () => {
    await expect(sendSms({ to: "233244123456", message: "Hi", senderId: "SchoolGH" }, {})).resolves.toMatchObject({
      ok: false,
      attempted: false,
    });
    await expect(
      sendSms({ to: "233244123456", message: "Hi", senderId: "SchoolGH" }, { SMS_PROVIDER: "hubtel", SMS_API_KEY: "secret", SMS_CLIENT_ID: "client" }),
    ).resolves.toMatchObject({ ok: false, attempted: false });
  });

  it("returns success only when the provider accepts the message", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("hubtel.com");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ Authorization: expect.stringMatching(/^Basic /) });
      expect(JSON.stringify(init)).not.toContain("NEXT_PUBLIC");
      return new Response(JSON.stringify({ messageId: "abc" }), { status: 200 });
    });
    const result = await sendSms(
      { to: "233244123456", message: "Hi", senderId: "SchoolGH" },
      { SMS_PROVIDER: "hubtel", SMS_API_KEY: "secret", SMS_CLIENT_ID: "client", SMS_LIVE: "true" },
      fetchImpl,
    );
    expect(result).toEqual({ ok: true, attempted: true, providerMessageId: "abc" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("reports a provider failure as not sent", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: "rejected" }), { status: 400 }));
    const result = await sendSms(
      { to: "233244123456", message: "Hi", senderId: "SchoolGH" },
      { SMS_PROVIDER: "arkesel", SMS_API_KEY: "secret", SMS_LIVE: "true" },
      fetchImpl,
    );
    expect(result).toEqual({ ok: false, attempted: true, error: "rejected" });
  });
});

describe("SMS delivery log", () => {
  it("logs sent only after a real send and logs failed only after an attempt", async () => {
    const log: SmsLogEntry[] = [];
    const summary = await deliverSms({
      recipients: [
        { id: "1", parentName: "Akua", parentPhone: "0244001100", label: "Kojo Mensah", vars: { balance: "20.00" } },
        { id: "2", parentName: "Yaa", parentPhone: "not-a-number", label: "Ama Owusu", vars: {} },
        { id: "3", parentName: "Efua", parentPhone: "0501239876", label: "Kofi Asare", vars: {} },
      ],
      message: "Balance GH₵{balance} for {student_name}",
      senderId: "SchoolGH",
      send: async (input) => {
        if (input.to.endsWith("4001100")) return { ok: true, attempted: true, providerMessageId: "ok-1" };
        return { ok: false, attempted: true, error: "network" };
      },
      log: async (entry) => {
        log.push(entry);
      },
    });

    expect(summary).toMatchObject({ sent: 1, failed: 1, skipped: 1 });
    expect(log).toEqual([
      { recipient: "Akua", studentLabel: "Kojo Mensah", status: "sent", txnId: "ok-1" },
      { recipient: "Efua", studentLabel: "Kofi Asare", status: "failed", txnId: "" },
    ]);
    expect(log.some((entry) => entry.status === "sent" && entry.txnId === "")).toBe(false);
  });

  it("does not log anything when the provider is not configured", async () => {
    const log: SmsLogEntry[] = [];
    const summary = await deliverSms({
      recipients: [{ id: "1", parentName: "Akua", parentPhone: "0244001100", label: "Kojo Mensah", vars: {} }],
      message: "Hello",
      senderId: "SchoolGH",
      send: async () => ({ ok: false, attempted: false, error: "SMS is not configured." }),
      log: async (entry) => {
        log.push(entry);
      },
    });
    expect(log).toEqual([]);
    expect(summary.sent).toBe(0);
    expect(summary.errors[0]).toMatch(/not configured/);
  });
});
