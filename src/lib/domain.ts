import { assertAcademicPeriod } from "@/lib/academic";
import { roundMoney } from "@/lib/format";
import type {
  AnnotatedPayment,
  FeeStatus,
  NewPaymentInput,
  NewStudentInput,
  PaymentRecord,
  SchoolProfile,
  StudentRecord,
  StudentView,
} from "@/lib/types";

export const CLASSES = [
  "Creche",
  "Nursery",
  "KG 1",
  "KG 2",
  "Basic 1",
  "Basic 2",
  "Basic 3",
  "Basic 4",
  "Basic 5",
  "Basic 6",
  "Basic 7",
  "Basic 8",
  "Basic 9",
] as const;

export const DEFAULT_CLASS_FEES: Record<string, number> = {
  Creche: 250,
  Nursery: 280,
  "KG 1": 300,
  "KG 2": 300,
  "Basic 1": 350,
  "Basic 2": 350,
  "Basic 3": 350,
  "Basic 4": 400,
  "Basic 5": 400,
  "Basic 6": 400,
  "Basic 7": 500,
  "Basic 8": 500,
  "Basic 9": 500,
};

export const DEFAULT_FEEDING_FEE = 15;

export const PAYMENT_METHODS = [
  "Cash",
  "MTN Mobile Money",
  "Telecel",
  "AirtelTigo",
  "Bank Transfer",
  "Cheque",
] as const;

export const DEFAULT_TPL_PAYMENT = `Dear {parent_name},

Payment confirmed.
Student: {student_name} ({student_id})
Amount: GH₵{amount}
Method: {method}
Date: {date}
Transaction: {txn_id}

{balance_msg}

Thank you.
— {school_name}`;

export const DEFAULT_TPL_REMINDER = `Dear {parent_name},

Fee reminder for {term} ({academic_year}).
Student: {student_name} ({student_id})
Balance: GH₵{balance}

Please pay at school or by mobile money.
Help: {school_phone}

— {school_name}`;

export const TEMPLATE_VARIABLES = [
  "{parent_name}",
  "{student_name}",
  "{student_id}",
  "{amount}",
  "{method}",
  "{date}",
  "{txn_id}",
  "{balance_msg}",
  "{balance}",
  "{term}",
  "{academic_year}",
  "{school_name}",
  "{school_phone}",
];

export function defaultClassFees(): Record<string, number> {
  return { ...DEFAULT_CLASS_FEES };
}

export function feeForClass(school: SchoolProfile, className: string, override?: number | null): number {
  if (override != null && Number.isFinite(override) && override >= 0) return roundMoney(override);
  const configured = school.classFees[className];
  if (configured != null && Number.isFinite(Number(configured))) return roundMoney(Number(configured));
  const fallback = DEFAULT_CLASS_FEES[className];
  if (fallback != null) return fallback;
  throw new Error(`Set a term fee for ${className} in Settings.`);
}

export function studentName(student: Pick<StudentRecord, "firstName" | "lastName">): string {
  return `${student.firstName} ${student.lastName}`.trim();
}

export function feeStatus(termFee: number, paid: number): FeeStatus {
  if (paid <= 0) return "owing";
  if (paid + 0.001 < termFee) return "partial";
  return "paid";
}

export function buildStudentViews(students: StudentRecord[], payments: PaymentRecord[]): StudentView[] {
  return students
    .map((student) => {
      const rows = payments
        .filter((payment) => payment.studentId === student.id)
        .sort(comparePayments);
      const paid = roundMoney(rows.reduce((sum, payment) => sum + payment.amount, 0));
      const balance = roundMoney(student.termFee - paid);
      const latest = rows[rows.length - 1];
      return {
        ...student,
        paid,
        balance,
        status: feeStatus(student.termFee, paid),
        lastPaymentOn: latest?.paidOn ?? null,
        lastMethod: latest?.method ?? null,
      };
    })
    .sort((a, b) => studentName(a).localeCompare(studentName(b)));
}

export function annotatePayments(students: StudentRecord[], payments: PaymentRecord[]): AnnotatedPayment[] {
  const fees = new Map(students.map((student) => [student.id, student.termFee]));
  const running = new Map<string, number>();
  const balanceById = new Map<string, number | null>();
  const ordered = [...payments].sort(comparePayments);
  for (const payment of ordered) {
    if (!payment.studentId || !fees.has(payment.studentId)) {
      balanceById.set(payment.id, null);
      continue;
    }
    const next = roundMoney((running.get(payment.studentId) ?? 0) + payment.amount);
    running.set(payment.studentId, next);
    balanceById.set(payment.id, roundMoney((fees.get(payment.studentId) ?? 0) - next));
  }
  return [...payments]
    .sort((a, b) => comparePayments(b, a))
    .map((payment) => ({ ...payment, balanceAfter: balanceById.get(payment.id) ?? null }));
}

export function classRollups(students: StudentView[]) {
  const names = new Set(students.map((student) => student.className));
  return [...names].map((className) => {
    const rows = students.filter((student) => student.className === className);
    const expected = roundMoney(rows.reduce((sum, student) => sum + student.termFee, 0));
    const collected = roundMoney(rows.reduce((sum, student) => sum + student.paid, 0));
    const percent = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    return { className, expected, collected, percent, count: rows.length };
  });
}

export function validateNewStudent(school: SchoolProfile, input: NewStudentInput): { termFee: number } {
  if (!input.firstName.trim() || !input.lastName.trim() || !input.parentName.trim() || !input.parentPhone.trim()) {
    throw new Error("First name, last name, parent name, and parent phone are required.");
  }
  if (!CLASSES.includes(input.className as (typeof CLASSES)[number])) {
    throw new Error("Choose a class from the list.");
  }
  const termFee = feeForClass(school, input.className, input.termFee);
  if (termFee < 0) throw new Error("Term fee cannot be negative.");
  return { termFee };
}

export function validatePayment(
  student: StudentView,
  input: NewPaymentInput,
): { amount: number; txnId: string; balanceAfter: number } {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a payment amount greater than zero.");
  }
  const amount = roundMoney(input.amount);
  if (amount > student.balance + 0.001) {
    throw new Error("That amount is higher than the outstanding balance.");
  }
  if (!input.method.trim()) throw new Error("Choose a payment method.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) throw new Error("Choose the payment date.");
  const txnId = input.txnId.trim() || "";
  if (txnId.length > 64) throw new Error("Transaction ID is too long.");
  const balanceAfter = roundMoney(student.balance - amount);
  return { amount, txnId, balanceAfter };
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z0-9_]+)\}/gi, (_, key: string) => vars[key] ?? "");
}

export function balanceMessage(balanceAfter: number): string {
  if (balanceAfter <= 0) return "Term fees are fully paid. Thank you.";
  return `Balance remaining: GH₵${balanceAfter.toFixed(2)}. Please pay before the end of term.`;
}

export function paymentTemplateVars(input: {
  school: SchoolProfile;
  student: StudentView;
  amount: number;
  method: string;
  paidOnLabel: string;
  txnId: string;
  balanceAfter: number;
}): Record<string, string> {
  assertAcademicPeriod(input.school.term, input.school.academicYear);
  return {
    parent_name: input.student.parentName,
    student_name: studentName(input.student),
    student_id: input.student.id,
    amount: input.amount.toFixed(2),
    method: input.method,
    date: input.paidOnLabel,
    txn_id: input.txnId,
    balance_msg: balanceMessage(input.balanceAfter),
    balance: Math.max(input.balanceAfter, 0).toFixed(2),
    term: input.school.term,
    academic_year: input.school.academicYear,
    school_name: input.school.name || "School",
    school_phone: input.school.phone,
  };
}

export function reminderVars(school: SchoolProfile, student: StudentView): Record<string, string> {
  return paymentTemplateVars({
    school,
    student,
    amount: 0,
    method: "",
    paidOnLabel: "",
    txnId: "",
    balanceAfter: student.balance,
  });
}

function comparePayments(a: PaymentRecord, b: PaymentRecord): number {
  const byDate = a.paidOn.localeCompare(b.paidOn);
  if (byDate !== 0) return byDate;
  return a.createdAt.localeCompare(b.createdAt);
}
