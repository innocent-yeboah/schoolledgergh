export type PaymentLinkRow = {
  studentId: string;
  schoolId: string;
  amount: number;
  status: "pending" | "paid";
};

export type SettleInput = {
  reference: string;
  amountCedis: number;
  currency: string;
  status: string;
  channel: string;
  metadataStudentId: string | null;
  link: PaymentLinkRow | null;
  existingPayment: boolean;
  outstanding: number;
};

export type SettleDecision =
  | { action: "duplicate" }
  | { action: "ignore"; reason: string }
  | { action: "record"; amount: number; method: string };

export function decideSettlement(input: SettleInput): SettleDecision {
  if (input.status !== "success") return { action: "ignore", reason: "Charge is not successful." };
  if (input.currency !== "GHS") return { action: "ignore", reason: "Currency is not GHS." };
  if (!Number.isFinite(input.amountCedis) || input.amountCedis <= 0) {
    return { action: "ignore", reason: "Charge amount is not a positive cedi amount." };
  }
  if (!input.link) return { action: "ignore", reason: "Unknown payment reference." };
  if (input.existingPayment || input.link.status === "paid") return { action: "duplicate" };
  if (input.metadataStudentId && input.metadataStudentId !== input.link.studentId) {
    return { action: "ignore", reason: "Student does not match the payment link." };
  }
  if (Math.abs(input.amountCedis - input.link.amount) > 0.001) {
    return { action: "ignore", reason: "Amount does not match the payment link." };
  }
  if (input.amountCedis > input.outstanding + 0.001) {
    return { action: "ignore", reason: "Amount is higher than the outstanding balance." };
  }
  const method = input.channel === "mobile_money" ? "Paystack Mobile Money" : "Paystack";
  return { action: "record", amount: input.amountCedis, method };
}
