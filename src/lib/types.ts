export type FeeStatus = "paid" | "partial" | "owing";

export type MessageChannel = "whatsapp" | "sms" | "email";

export type MessageStatus = "opened" | "sent" | "failed";

export type SchoolProfile = {
  id: string;
  userId: string;
  name: string;
  adminName: string;
  phone: string;
  email: string;
  address: string;
  motto: string;
  term: string;
  academicYear: string;
  feedingFee: number;
  classFees: Record<string, number>;
  tplPayment: string;
  tplReminder: string;
};

export type StudentRecord = {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  className: string;
  gender: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  termFee: number;
};

export type PaymentRecord = {
  id: string;
  studentId: string | null;
  studentName: string;
  className: string;
  amount: number;
  method: string;
  paidOn: string;
  txnId: string;
  notes: string;
  createdAt: string;
};

export type FeedingRecord = {
  id: string;
  studentId: string;
  feedDate: string;
};

export type MessageRecord = {
  id: string;
  channel: MessageChannel;
  messageType: string;
  recipient: string;
  studentLabel: string;
  txnId: string;
  status: MessageStatus;
  createdAt: string;
};

export type LedgerSnapshot = {
  school: SchoolProfile | null;
  students: StudentRecord[];
  payments: PaymentRecord[];
  feeding: FeedingRecord[];
  messages: MessageRecord[];
};

export type StudentView = StudentRecord & {
  paid: number;
  balance: number;
  status: FeeStatus;
  lastPaymentOn: string | null;
  lastMethod: string | null;
};

export type AnnotatedPayment = PaymentRecord & {
  balanceAfter: number | null;
};

export type AdminSchool = {
  id: string;
  userId: string;
  name: string;
  adminName: string;
  phone: string;
  email: string;
  address: string;
  term: string;
  academicYear: string;
  studentCount: number;
  feesCollected: number;
  createdAt: string;
};

export type NewStudentInput = {
  firstName: string;
  lastName: string;
  className: string;
  gender: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  termFee: number | null;
};

export type NewPaymentInput = {
  studentId: string;
  amount: number;
  method: string;
  paidOn: string;
  txnId: string;
  notes: string;
};

export type NewMessageInput = {
  channel: MessageChannel;
  messageType: string;
  recipient: string;
  studentLabel: string;
  txnId: string;
  status: Exclude<MessageStatus, "sent">;
};

export type NewSchoolInput = {
  name: string;
  adminName: string;
  phone: string;
  email: string;
  address: string;
  motto: string;
  term: string;
  academicYear: string;
  feedingFee: number;
};
