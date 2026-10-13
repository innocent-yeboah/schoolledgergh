export type SmsProviderName = "hubtel" | "arkesel" | "mnotify";

export const DEFAULT_SMS_PROVIDER: SmsProviderName = "arkesel";

export type SmsSendInput = {
  to: string;
  message: string;
  senderId: string;
};

export type SmsSendResult =
  | { ok: true; attempted: true; providerMessageId: string }
  | { ok: false; attempted: boolean; error: string };

export type SmsEnv = {
  SMS_PROVIDER?: string;
  SMS_API_KEY?: string;
  SMS_CLIENT_ID?: string;
  SMS_SENDER_ID?: string;
  SMS_LIVE?: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function readSmsEnv(source: Record<string, string | undefined> = process.env): SmsEnv {
  return {
    SMS_PROVIDER: source.SMS_PROVIDER,
    SMS_API_KEY: source.SMS_API_KEY,
    SMS_CLIENT_ID: source.SMS_CLIENT_ID,
    SMS_SENDER_ID: source.SMS_SENDER_ID,
    SMS_LIVE: source.SMS_LIVE,
  };
}

export function resolveSmsProvider(env: SmsEnv): SmsProviderName | null {
  const raw = env.SMS_PROVIDER?.trim().toLowerCase() ?? "";
  if (!raw) return DEFAULT_SMS_PROVIDER;
  if (raw === "hubtel" || raw === "arkesel" || raw === "mnotify") return raw;
  return null;
}

export function smsIsLive(env: SmsEnv): boolean {
  const provider = resolveSmsProvider(env);
  if (!provider || env.SMS_LIVE !== "true" || !env.SMS_API_KEY?.trim()) return false;
  if (provider === "hubtel" && !env.SMS_CLIENT_ID?.trim()) return false;
  return true;
}

export async function sendSms(
  input: SmsSendInput,
  env: SmsEnv = readSmsEnv(),
  fetchImpl: FetchLike = fetch,
): Promise<SmsSendResult> {
  const provider = resolveSmsProvider(env);
  const apiKey = env.SMS_API_KEY?.trim() ?? "";
  const senderId = (input.senderId.trim() || env.SMS_SENDER_ID?.trim() || "SchoolGH").slice(0, 11);

  if (!provider) {
    return { ok: false, attempted: false, error: "SMS is not configured. Set SMS_PROVIDER to arkesel, hubtel, or mnotify on the server." };
  }
  if (!apiKey) {
    return { ok: false, attempted: false, error: "SMS is not configured. The server has no SMS_API_KEY, so nothing was sent." };
  }
  if (env.SMS_LIVE !== "true") {
    return {
      ok: false,
      attempted: false,
      error: "SMS is in stub mode. Set SMS_LIVE=true after the provider credentials are real. Nothing was sent.",
    };
  }
  if (!input.to || !input.message.trim()) {
    return { ok: false, attempted: false, error: "A recipient and a message are required." };
  }

  try {
    if (provider === "hubtel") {
      return await sendHubtel({ to: input.to, message: input.message, senderId, apiKey, clientId: env.SMS_CLIENT_ID?.trim() ?? "" }, fetchImpl);
    }
    if (provider === "mnotify") {
      return await sendMnotify({ to: input.to, message: input.message, senderId, apiKey }, fetchImpl);
    }
    return await sendArkesel({ to: input.to, message: input.message, senderId, apiKey }, fetchImpl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The SMS provider could not be reached.";
    return { ok: false, attempted: true, error: message };
  }
}

async function sendHubtel(
  input: { to: string; message: string; senderId: string; apiKey: string; clientId: string },
  fetchImpl: FetchLike,
): Promise<SmsSendResult> {
  if (!input.clientId) {
    return { ok: false, attempted: false, error: "Hubtel needs SMS_CLIENT_ID as well as SMS_API_KEY. Nothing was sent." };
  }
  const response = await fetchImpl("https://smsc.hubtel.com/v1/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${input.clientId}:${input.apiKey}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ From: input.senderId, To: input.to, Content: input.message }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    return { ok: false, attempted: true, error: textField(body, "message") ?? `Hubtel returned ${response.status}.` };
  }
  const providerMessageId = textField(body, "messageId") ?? textField(body, "MessageId") ?? nestedId(body) ?? "hubtel";
  return { ok: true, attempted: true, providerMessageId };
}

async function sendArkesel(
  input: { to: string; message: string; senderId: string; apiKey: string },
  fetchImpl: FetchLike,
): Promise<SmsSendResult> {
  const response = await fetchImpl("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: {
      "api-key": input.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sender: input.senderId, message: input.message, recipients: [input.to] }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    return { ok: false, attempted: true, error: textField(body, "message") ?? `Arkesel returned ${response.status}.` };
  }
  const providerMessageId = firstDataId(body) ?? textField(body, "id") ?? "arkesel";
  return { ok: true, attempted: true, providerMessageId };
}

async function sendMnotify(
  input: { to: string; message: string; senderId: string; apiKey: string },
  fetchImpl: FetchLike,
): Promise<SmsSendResult> {
  const response = await fetchImpl(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(input.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: [input.to],
      sender: input.senderId,
      message: input.message,
      is_schedule: false,
      schedule_date: "",
    }),
  });
  const body = await readJson(response);
  const accepted = response.ok && textField(body, "status") === "success" && (textField(body, "code") === "2000" || numberField(body, "code") === 2000);
  if (!accepted) {
    return { ok: false, attempted: true, error: textField(body, "message") ?? `mNotify returned ${response.status}.` };
  }
  return { ok: true, attempted: true, providerMessageId: summaryId(body) ?? "mnotify" };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function numberField(body: unknown, key: string): number | null {
  if (!body || typeof body !== "object" || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function summaryId(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("summary" in body)) return null;
  const summary = (body as { summary?: unknown }).summary;
  if (!summary || typeof summary !== "object" || !("_id" in summary)) return null;
  const value = (summary as { _id?: unknown })._id;
  return typeof value === "string" && value ? value : null;
}

function textField(body: unknown, key: string): string | null {
  if (!body || typeof body !== "object" || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

function nestedId(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("messageId" in data)) return null;
  const value = (data as { messageId?: unknown }).messageId;
  return typeof value === "string" ? value : null;
}

function firstDataId(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object" || !("id" in data[0])) return null;
  const value = (data[0] as { id?: unknown }).id;
  return value == null ? null : String(value);
}
