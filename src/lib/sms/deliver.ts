import { fillTemplate } from "@/lib/domain";
import { toGhInternational } from "@/lib/phone";
import { sendSms, type SmsSendResult } from "@/lib/sms/adapter";

export type SmsRecipient = {
  id: string;
  parentName: string;
  parentPhone: string;
  label: string;
  vars: Record<string, string>;
};

export type SmsLogEntry = {
  recipient: string;
  studentLabel: string;
  status: "sent" | "failed";
  txnId: string;
};

export type DeliverSmsResult = {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

export async function deliverSms(input: {
  recipients: SmsRecipient[];
  message: string;
  senderId: string;
  send?: typeof sendSms;
  log: (entry: SmsLogEntry) => Promise<void>;
}): Promise<DeliverSmsResult> {
  const send = input.send ?? sendSms;
  const summary: DeliverSmsResult = { sent: 0, failed: 0, skipped: 0, errors: [] };
  if (!input.message.trim()) {
    summary.errors.push("Write an SMS message first.");
    return summary;
  }

  for (const recipient of input.recipients) {
    const phone = toGhInternational(recipient.parentPhone);
    if (!phone) {
      summary.skipped += 1;
      summary.errors.push(`${recipient.label} has no valid Ghana phone number.`);
      continue;
    }
    const body = fillTemplate(input.message, { ...recipient.vars, parent_name: recipient.parentName, student_name: recipient.label });
    const result: SmsSendResult = await send({ to: phone, message: body, senderId: input.senderId });
    if (result.ok) {
      await input.log({
        recipient: recipient.parentName,
        studentLabel: recipient.label,
        status: "sent",
        txnId: result.providerMessageId,
      });
      summary.sent += 1;
      continue;
    }
    if (result.attempted) {
      await input.log({
        recipient: recipient.parentName,
        studentLabel: recipient.label,
        status: "failed",
        txnId: "",
      });
      summary.failed += 1;
    } else {
      summary.skipped += 1;
    }
    summary.errors.push(result.error);
  }

  return summary;
}
