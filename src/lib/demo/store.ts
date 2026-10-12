import { suggestedAcademicPeriod } from "@/lib/academic";
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
import { createId, createTxnId, todayISO } from "@/lib/format";
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

const KEY = "slgh.demo.school.v1";

export function createDemoSnapshot(now = new Date()): LedgerSnapshot {
  const period = suggestedAcademicPeriod(now);
  const school: SchoolProfile = {
    id: "demo-school",
    userId: "demo-user",
    name: "Bright Future Academy",
    adminName: "Adwoa Mensah",
    phone: "0244123456",
    email: "demo@brightfuture.edu.gh",
    address: "East Legon, Accra",
    motto: "Excellence through discipline",
    term: period.term,
    academicYear: period.academicYear,
    feedingFee: DEFAULT_FEEDING_FEE,
    classFees: defaultClassFees(),
    tplPayment: DEFAULT_TPL_PAYMENT,
    tplReminder: DEFAULT_TPL_REMINDER,
  };
  const students: StudentRecord[] = [
    student("S-KOJO", school.id, "Kojo", "Mensah", "Basic 4", "Male", "Akua Mensah", "0244001100", "akua@example.com", 400),
    student("S-AMA", school.id, "Ama", "Owusu", "Basic 2", "Female", "Yaa Owusu", "0202002200", "yaa@example.com", 350),
    student("S-ESI", school.id, "Esi", "Boateng", "KG 1", "Female", "Kwame Boateng", "0555003300", "", 300),
    student("S-YAW", school.id, "Yaw", "Darko", "Basic 6", "Male", "Abena Darko", "0277004400", "abena.darko@example.com", 400),
    student("S-ABE", school.id, "Abena", "Sarpong", "Creche", "Female", "Kweku Sarpong", "0244112233", "", 250),
    student("S-KOF", school.id, "Kofi", "Asare", "Basic 9", "Male", "Efua Asare", "0501239876", "efua@example.com", 500),
  ];
  const day = todayISO(now);
  const payments: PaymentRecord[] = [
    payment("P-KOJO", "S-KOJO", "Kojo Mensah", "Basic 4", 400, "Cash", day, "SL-DEMO-KOJO"),
    payment("P-AMA", "S-AMA", "Ama Owusu", "Basic 2", 100, "MTN Mobile Money", day, "SL-DEMO-AMA", "First instalment"),
    payment("P-YAW", "S-YAW", "Yaw Darko", "Basic 6", 200, "Bank Transfer", day, "SL-DEMO-YAW"),
    payment("P-ABE", "S-ABE", "Abena Sarpong", "Creche", 250, "Telecel", day, "SL-DEMO-ABE"),
  ];
  const feeding: FeedingRecord[] = [
    { id: "F-KOJO", studentId: "S-KOJO", feedDate: day },
    { id: "F-AMA", studentId: "S-AMA", feedDate: day },
  ];
  const messages: MessageRecord[] = [
    {
      id: "M-1",
      channel: "whatsapp",
      messageType: "reminder",
      recipient: "Kwame Boateng",
      studentLabel: "Esi Boateng",
      txnId: "",
      status: "opened",
      createdAt: now.toISOString(),
    },
  ];
  return { school, students, payments, feeding, messages };
}

function student(
  id: string,
  schoolId: string,
  firstName: string,
  lastName: string,
  className: string,
  gender: string,
  parentName: string,
  parentPhone: string,
  parentEmail: string,
  termFee: number,
): StudentRecord {
  return { id, schoolId, firstName, lastName, className, gender, parentName, parentPhone, parentEmail, termFee };
}

function payment(
  id: string,
  studentId: string,
  studentNameValue: string,
  className: string,
  amount: number,
  method: string,
  paidOn: string,
  txnId: string,
  notes = "",
): PaymentRecord {
  return {
    id,
    studentId,
    studentName: studentNameValue,
    className,
    amount,
    method,
    paidOn,
    txnId,
    notes,
    createdAt: new Date().toISOString(),
  };
}

export class DemoLedger {
  private snapshot: LedgerSnapshot;

  constructor() {
    this.snapshot = read() ?? createDemoSnapshot();
    this.persist();
  }

  load(): LedgerSnapshot {
    return structuredClone(this.snapshot);
  }

  saveSchool(school: SchoolProfile): SchoolProfile {
    if (!this.snapshot.school) throw new Error("Create the school before saving settings.");
    this.snapshot.school = { ...school, id: this.snapshot.school.id, userId: this.snapshot.school.userId };
    this.persist();
    return structuredClone(this.snapshot.school);
  }

  createSchool(input: NewSchoolInput): SchoolProfile {
    const school: SchoolProfile = {
      id: "demo-school",
      userId: "demo-user",
      name: input.name.trim(),
      adminName: input.adminName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      motto: input.motto.trim(),
      term: input.term.trim(),
      academicYear: input.academicYear.trim(),
      feedingFee: input.feedingFee,
      classFees: defaultClassFees(),
      tplPayment: DEFAULT_TPL_PAYMENT,
      tplReminder: DEFAULT_TPL_REMINDER,
    };
    if (!school.name) throw new Error("School name is required.");
    this.snapshot.school = school;
    this.persist();
    return structuredClone(school);
  }

  addStudent(input: NewStudentInput): StudentRecord {
    const school = this.requireSchool();
    const { termFee } = validateNewStudent(school, input);
    const row: StudentRecord = {
      id: createId("S"),
      schoolId: school.id,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      className: input.className,
      gender: input.gender,
      parentName: input.parentName.trim(),
      parentPhone: input.parentPhone.trim(),
      parentEmail: input.parentEmail.trim(),
      termFee,
    };
    this.snapshot.students.push(row);
    this.persist();
    return structuredClone(row);
  }

  removeStudent(id: string): void {
    const existing = this.snapshot.students.find((item) => item.id === id);
    if (!existing) throw new Error("That student is no longer on the roll.");
    this.snapshot.students = this.snapshot.students.filter((item) => item.id !== id);
    this.snapshot.feeding = this.snapshot.feeding.filter((item) => item.studentId !== id);
    this.snapshot.payments = this.snapshot.payments.map((item) =>
      item.studentId === id ? { ...item, studentId: null } : item,
    );
    this.persist();
  }

  recordPayment(input: NewPaymentInput): PaymentRecord {
    this.requireSchool();
    const view = buildStudentViews(this.snapshot.students, this.snapshot.payments).find((item) => item.id === input.studentId);
    if (!view) throw new Error("Choose a student who is still enrolled.");
    const validated = validatePayment(view, input);
    const txnId = validated.txnId || createTxnId();
    if (this.snapshot.payments.some((item) => item.txnId === txnId)) {
      throw new Error("That transaction ID has already been used.");
    }
    const row: PaymentRecord = {
      id: createId("P"),
      studentId: view.id,
      studentName: studentName(view),
      className: view.className,
      amount: validated.amount,
      method: input.method,
      paidOn: input.paidOn,
      txnId,
      notes: input.notes.trim(),
      createdAt: new Date().toISOString(),
    };
    this.snapshot.payments.push(row);
    this.persist();
    return structuredClone(row);
  }

  markFeeding(studentId: string, date: string): "marked" | "already" {
    if (!this.snapshot.students.some((item) => item.id === studentId)) {
      throw new Error("That student is no longer enrolled.");
    }
    if (this.snapshot.feeding.some((item) => item.studentId === studentId && item.feedDate === date)) return "already";
    this.snapshot.feeding.push({ id: createId("F"), studentId, feedDate: date });
    this.persist();
    return "marked";
  }

  markAllFeeding(date: string): { marked: number; already: number } {
    let marked = 0;
    let already = 0;
    for (const student of this.snapshot.students) {
      const result = this.markFeeding(student.id, date);
      if (result === "marked") marked += 1;
      else already += 1;
    }
    return { marked, already };
  }

  logMessage(input: NewMessageInput): MessageRecord {
    this.requireSchool();
    const row: MessageRecord = {
      id: createId("M"),
      channel: input.channel,
      messageType: input.messageType,
      recipient: input.recipient,
      studentLabel: input.studentLabel,
      txnId: input.txnId,
      status: input.status,
      createdAt: new Date().toISOString(),
    };
    this.snapshot.messages.unshift(row);
    this.snapshot.messages = this.snapshot.messages.slice(0, 100);
    this.persist();
    return structuredClone(row);
  }

  reset(): void {
    this.snapshot = createDemoSnapshot();
    this.persist();
  }

  private requireSchool(): SchoolProfile {
    if (!this.snapshot.school) throw new Error("Save the school profile first.");
    return this.snapshot.school;
  }

  private persist(): void {
    localStorage.setItem(KEY, JSON.stringify(this.snapshot));
  }
}

function read(): LedgerSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LedgerSnapshot;
    if (!parsed.school || !Array.isArray(parsed.students) || !Array.isArray(parsed.payments)) return null;
    return parsed;
  } catch {
    return null;
  }
}
