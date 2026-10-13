import { describe, expect, it } from "vitest";
import { assertAcademicPeriod, periodLabel, suggestedAcademicPeriod } from "@/lib/academic";
import { summarizeSchools } from "@/lib/admin/summary";
import { decideRedirect } from "@/lib/auth/redirect";
import { csvCell, toCsv } from "@/lib/csv";
import {
  buildStudentViews,
  feeStatus,
  validatePayment,
} from "@/lib/domain";
import { bulkBccMailto, individualMailto } from "@/lib/email/mailto";
import { toGhInternational, whatsAppLink } from "@/lib/phone";
import type { PaymentRecord, StudentRecord } from "@/lib/types";

describe("academic period", () => {
  it("suggests a Ghana term from the date instead of a fixed year", () => {
    expect(suggestedAcademicPeriod(new Date(2026, 9, 12))).toEqual({ term: "Term 1", academicYear: "2026/2027" });
    expect(suggestedAcademicPeriod(new Date(2026, 0, 12))).toEqual({ term: "Term 2", academicYear: "2025/2026" });
    expect(suggestedAcademicPeriod(new Date(2026, 5, 1))).toEqual({ term: "Term 3", academicYear: "2025/2026" });
  });

  it("refuses to save a blank period", () => {
    expect(() => assertAcademicPeriod("  ", "2026/2027")).toThrow(/term and the academic year/);
    expect(periodLabel("", "")).toBe("Set term in Settings");
  });
});

describe("balances", () => {
  const student: StudentRecord = {
    id: "S1",
    schoolId: "school",
    firstName: "Ama",
    lastName: "Owusu",
    className: "Basic 2",
    gender: "Female",
    parentName: "Yaa Owusu",
    parentPhone: "0202002200",
    parentEmail: "",
    termFee: 350,
  };

  it("derives paid, balance, and status from payments", () => {
    const views = buildStudentViews([student], [pay("P1", 100, "2026-10-01"), pay("P2", 50, "2026-10-02")]);
    expect(views[0]).toMatchObject({ paid: 150, balance: 200, status: "partial" });
    expect(feeStatus(350, 0)).toBe("owing");
    expect(feeStatus(350, 350)).toBe("paid");
  });

  it("rejects a payment above the derived balance", () => {
    const view = { ...student, paid: 300, balance: 50, status: "partial" as const, lastPaymentOn: null, lastMethod: null };
    expect(() => validatePayment(view, { studentId: "S1", amount: 80, method: "Cash", paidOn: "2026-10-12", txnId: "", notes: "" })).toThrow(/outstanding/);
    expect(validatePayment(view, { studentId: "S1", amount: 50, method: "Cash", paidOn: "2026-10-12", txnId: "MOMO1", notes: "note" }).txnId).toBe("MOMO1");
  });
});

describe("parent email privacy", () => {
  const emails = ["ama@parent.test", "kofi@parent.test"];

  it("puts bulk recipients in BCC and not in To", () => {
    const link = bulkBccMailto({ bcc: emails, subject: "Fees", body: "Please pay." });
    expect(link.startsWith("mailto:?")).toBe(true);
    expect(link).toContain("bcc=");
    expect(link.split("?")[0]).not.toContain("@");
    expect(decodeURIComponent(link)).toContain("ama@parent.test");
    expect(decodeURIComponent(link)).toContain("kofi@parent.test");
  });

  it("addresses one parent at a time", () => {
    const link = individualMailto({ to: emails[0], subject: "Balance", body: "GH₵20" });
    expect(link.startsWith(`mailto:${encodeURIComponent(emails[0])}`)).toBe(true);
    expect(link).not.toContain(emails[1]);
  });
});

describe("phones and csv", () => {
  it("normalises Ghana numbers for WhatsApp", () => {
    expect(toGhInternational("0244123456")).toBe("233244123456");
    expect(whatsAppLink("0244123456", "Hello")).toBe("https://wa.me/233244123456?text=Hello");
    expect(toGhInternational("123")).toBeNull();
  });

  it("escapes spreadsheet formulas and quotes", () => {
    expect(csvCell('=cmd|"/c calc"!A0')).toBe(`"'=cmd|""/c calc""!A0"`);
    expect(toCsv([["Ama", "Owusu"]])).toBe(`"Ama","Owusu"`);
  });
});

describe("routing", () => {
  it("keeps demo and signed-out visitors on the right screen", () => {
    expect(decideRedirect({ pathname: "/", demo: "", signedIn: false, supabaseConfigured: false })).toBe("/login");
    expect(decideRedirect({ pathname: "/app", demo: "", signedIn: false, supabaseConfigured: true })).toBe("/login");
    expect(decideRedirect({ pathname: "/", demo: "school", signedIn: false, supabaseConfigured: false })).toBe("/app");
    expect(decideRedirect({ pathname: "/admin", demo: "school", signedIn: false, supabaseConfigured: true })).toBe("/app");
    expect(decideRedirect({ pathname: "/app", demo: "admin", signedIn: false, supabaseConfigured: true })).toBe("/admin");
    expect(decideRedirect({ pathname: "/app", demo: "", signedIn: true, supabaseConfigured: true })).toBeNull();
    expect(decideRedirect({ pathname: "/api/sms/send", demo: "", signedIn: false, supabaseConfigured: true })).toBeNull();
  });
});

describe("admin totals", () => {
  it("counts students and sums payments per school", () => {
    const rows = summarizeSchools(
      [
        {
          id: "s1",
          user_id: "u1",
          name: "Harbour",
          admin_name: "Kwesi",
          phone: "020",
          email: "a@school.test",
          address: "",
          term: "Term 1",
          academic_year: "2026/2027",
          created_at: "2026-10-01",
        },
      ],
      [{ school_id: "s1" }, { school_id: "s1" }],
      [
        { school_id: "s1", amount: "10.50" },
        { school_id: "s1", amount: 4.5 },
      ],
    );
    expect(rows[0]).toMatchObject({ studentCount: 2, feesCollected: 15, academicYear: "2026/2027" });
  });
});

function pay(id: string, amount: number, paidOn: string): PaymentRecord {
  return {
    id,
    studentId: "S1",
    studentName: "Ama Owusu",
    className: "Basic 2",
    amount,
    method: "Cash",
    paidOn,
    txnId: id,
    notes: "",
    createdAt: `${paidOn}T00:00:00.000Z`,
  };
}
