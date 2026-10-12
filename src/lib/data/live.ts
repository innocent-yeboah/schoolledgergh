import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_FEEDING_FEE,
  DEFAULT_TPL_PAYMENT,
  DEFAULT_TPL_REMINDER,
  buildStudentViews,
  defaultClassFees,
  studentName,
  validateNewStudent,
  validatePayment,
} from "@/lib/domain";
import { createId, createTxnId } from "@/lib/format";
import { clearPendingSchool, readPendingSchool } from "@/lib/mode";
import type {
  FeedingRecord,
  LedgerSnapshot,
  MessageRecord,
  NewMessageInput,
  NewPaymentInput,
  NewSchoolInput,
  NewStudentInput,
  PaymentRecord,
  SchoolProfile,
  StudentRecord,
} from "@/lib/types";

type SchoolRow = {
  id: string;
  user_id: string;
  name: string;
  admin_name: string;
  phone: string;
  email: string;
  address: string;
  motto: string;
  term: string;
  academic_year: string;
  feeding_fee: number | string;
  class_fees: unknown;
  tpl_payment: string;
  tpl_reminder: string;
};

type StudentRow = {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  class_name: string;
  gender: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  term_fee: number | string;
};

type PaymentRow = {
  id: string;
  student_id: string | null;
  student_name: string;
  class_name: string;
  amount: number | string;
  method: string;
  paid_on: string;
  txn_id: string;
  notes: string;
  created_at: string;
};

type FeedingRow = { id: string; student_id: string; feed_date: string };

type MessageRow = {
  id: string;
  channel: MessageRecord["channel"];
  message_type: string;
  recipient: string;
  student_label: string;
  txn_id: string;
  status: MessageRecord["status"];
  created_at: string;
};

export class LiveLedger {
  private client = createClient();
  private userId = "";

  async load(): Promise<{ userId: string; snapshot: LedgerSnapshot }> {
    const user = await this.currentUser();
    this.userId = user.id;
    let school = await this.fetchSchool(user.id);
    if (!school) {
      const pending = readPendingSchool();
      if (pending) {
        school = await this.insertSchool(user.id, {
          name: pending.name,
          adminName: pending.adminName,
          phone: pending.phone,
          email: pending.email || user.email || "",
          address: "",
          motto: "",
          term: pending.term,
          academicYear: pending.academicYear,
          feedingFee: DEFAULT_FEEDING_FEE,
        });
        clearPendingSchool();
      }
    }
    const [students, payments, feeding, messages] = await Promise.all([
      this.fetchStudents(user.id),
      this.fetchPayments(user.id),
      this.fetchFeeding(user.id),
      this.fetchMessages(user.id),
    ]);
    return { userId: user.id, snapshot: { school, students, payments, feeding, messages } };
  }

  async saveSchool(school: SchoolProfile): Promise<SchoolProfile> {
    const { data, error } = await this.client
      .from("schools")
      .update(schoolToRow(school))
      .eq("id", school.id)
      .eq("user_id", school.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapSchool(data as SchoolRow);
  }

  async createSchool(input: NewSchoolInput): Promise<SchoolProfile> {
    const user = await this.currentUser();
    const existing = await this.fetchSchool(user.id);
    if (existing) throw new Error("This account already has a school. Edit it in Settings.");
    return this.insertSchool(user.id, input);
  }

  async addStudent(school: SchoolProfile, input: NewStudentInput): Promise<StudentRecord> {
    const { termFee } = validateNewStudent(school, input);
    const row = {
      id: createId("S"),
      school_id: school.id,
      user_id: school.userId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      class_name: input.className,
      gender: input.gender,
      parent_name: input.parentName.trim(),
      parent_phone: input.parentPhone.trim(),
      parent_email: input.parentEmail.trim(),
      term_fee: termFee,
    };
    const { data, error } = await this.client.from("students").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    return mapStudent(data as StudentRow);
  }

  async removeStudent(school: SchoolProfile, id: string): Promise<void> {
    const { error } = await this.client.from("students").delete().eq("id", id).eq("user_id", school.userId);
    if (error) throw new Error(error.message);
  }

  async recordPayment(school: SchoolProfile, students: StudentRecord[], payments: PaymentRecord[], input: NewPaymentInput): Promise<PaymentRecord> {
    const view = buildStudentViews(students, payments).find((item) => item.id === input.studentId);
    if (!view) throw new Error("Choose a student who is still enrolled.");
    const validated = validatePayment(view, input);
    const txnId = validated.txnId || createTxnId();
    const row = {
      id: createId("P"),
      school_id: school.id,
      user_id: school.userId,
      student_id: view.id,
      student_name: studentName(view),
      class_name: view.className,
      amount: validated.amount,
      method: input.method,
      paid_on: input.paidOn,
      txn_id: txnId,
      notes: input.notes.trim(),
    };
    const { data, error } = await this.client.from("payments").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    return mapPayment(data as PaymentRow);
  }

  async markFeeding(school: SchoolProfile, studentId: string, date: string): Promise<"marked" | "already"> {
    const { error } = await this.client.from("feeding_marks").insert({
      school_id: school.id,
      user_id: school.userId,
      student_id: studentId,
      feed_date: date,
    });
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) return "already";
      throw new Error(error.message);
    }
    return "marked";
  }

  async logMessage(school: SchoolProfile, input: NewMessageInput): Promise<void> {
    const { error } = await this.client.from("message_log").insert({
      school_id: school.id,
      user_id: school.userId,
      channel: input.channel,
      message_type: input.messageType,
      recipient: input.recipient,
      student_label: input.studentLabel,
      txn_id: input.txnId,
      status: input.status,
    });
    if (error) throw new Error(error.message);
  }

  private async insertSchool(userId: string, input: NewSchoolInput): Promise<SchoolProfile> {
    const { data, error } = await this.client
      .from("schools")
      .insert({
        user_id: userId,
        name: input.name.trim(),
        admin_name: input.adminName.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        address: input.address.trim(),
        motto: input.motto.trim(),
        term: input.term.trim(),
        academic_year: input.academicYear.trim(),
        feeding_fee: input.feedingFee,
        class_fees: defaultClassFees(),
        tpl_payment: DEFAULT_TPL_PAYMENT,
        tpl_reminder: DEFAULT_TPL_REMINDER,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapSchool(data as SchoolRow);
  }

  private async currentUser() {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Sign in required.");
    return data.user;
  }

  private async fetchSchool(userId: string): Promise<SchoolProfile | null> {
    const { data, error } = await this.client.from("schools").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSchool(data as SchoolRow) : null;
  }

  private async fetchStudents(userId: string): Promise<StudentRecord[]> {
    const { data, error } = await this.client.from("students").select("*").eq("user_id", userId).order("first_name");
    if (error) throw new Error(error.message);
    return ((data ?? []) as StudentRow[]).map(mapStudent);
  }

  private async fetchPayments(userId: string): Promise<PaymentRecord[]> {
    const { data, error } = await this.client.from("payments").select("*").eq("user_id", userId).order("paid_on", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as PaymentRow[]).map(mapPayment);
  }

  private async fetchFeeding(userId: string): Promise<FeedingRecord[]> {
    const { data, error } = await this.client.from("feeding_marks").select("id, student_id, feed_date").eq("user_id", userId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as FeedingRow[]).map((row) => ({ id: row.id, studentId: row.student_id, feedDate: row.feed_date }));
  }

  private async fetchMessages(userId: string): Promise<MessageRecord[]> {
    const { data, error } = await this.client
      .from("message_log")
      .select("id, channel, message_type, recipient, student_label, txn_id, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return ((data ?? []) as MessageRow[]).map((row) => ({
      id: row.id,
      channel: row.channel,
      messageType: row.message_type,
      recipient: row.recipient,
      studentLabel: row.student_label,
      txnId: row.txn_id,
      status: row.status,
      createdAt: row.created_at,
    }));
  }
}

function mapSchool(row: SchoolRow): SchoolProfile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name ?? "",
    adminName: row.admin_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    motto: row.motto ?? "",
    term: row.term,
    academicYear: row.academic_year,
    feedingFee: Number(row.feeding_fee) || 0,
    classFees: asFeeMap(row.class_fees),
    tplPayment: row.tpl_payment?.trim() ? row.tpl_payment : DEFAULT_TPL_PAYMENT,
    tplReminder: row.tpl_reminder?.trim() ? row.tpl_reminder : DEFAULT_TPL_REMINDER,
  };
}

function schoolToRow(school: SchoolProfile) {
  return {
    name: school.name.trim(),
    admin_name: school.adminName.trim(),
    phone: school.phone.trim(),
    email: school.email.trim(),
    address: school.address.trim(),
    motto: school.motto.trim(),
    term: school.term.trim(),
    academic_year: school.academicYear.trim(),
    feeding_fee: school.feedingFee,
    class_fees: school.classFees,
    tpl_payment: school.tplPayment,
    tpl_reminder: school.tplReminder,
  };
}

function mapStudent(row: StudentRow): StudentRecord {
  return {
    id: row.id,
    schoolId: row.school_id,
    firstName: row.first_name,
    lastName: row.last_name,
    className: row.class_name,
    gender: row.gender ?? "",
    parentName: row.parent_name,
    parentPhone: row.parent_phone,
    parentEmail: row.parent_email ?? "",
    termFee: Number(row.term_fee) || 0,
  };
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    className: row.class_name,
    amount: Number(row.amount) || 0,
    method: row.method,
    paidOn: row.paid_on,
    txnId: row.txn_id,
    notes: row.notes ?? "",
    createdAt: row.created_at,
  };
}

function asFeeMap(value: unknown): Record<string, number> {
  const source = typeof value === "string" ? safeParse(value) : value;
  if (!source || typeof source !== "object") return defaultClassFees();
  const fees: Record<string, number> = {};
  for (const [key, fee] of Object.entries(source as Record<string, unknown>)) {
    const amount = Number(fee);
    if (Number.isFinite(amount)) fees[key] = amount;
  }
  return Object.keys(fees).length ? fees : defaultClassFees();
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
