import { roundMoney } from "@/lib/format";
import type { AdminSchool } from "@/lib/types";

export type SchoolRow = {
  id: string;
  user_id: string;
  name: string;
  admin_name: string;
  phone: string;
  email: string;
  address: string;
  term: string;
  academic_year: string;
  created_at: string;
};

export function summarizeSchools(
  schools: SchoolRow[],
  students: { school_id: string }[],
  payments: { school_id: string; amount: number | string }[],
): AdminSchool[] {
  const studentCount = new Map<string, number>();
  for (const student of students) {
    studentCount.set(student.school_id, (studentCount.get(student.school_id) ?? 0) + 1);
  }
  const fees = new Map<string, number>();
  for (const payment of payments) {
    fees.set(payment.school_id, roundMoney((fees.get(payment.school_id) ?? 0) + Number(payment.amount)));
  }
  return [...schools]
    .map((school) => ({
      id: school.id,
      userId: school.user_id,
      name: school.name,
      adminName: school.admin_name,
      phone: school.phone,
      email: school.email,
      address: school.address,
      term: school.term,
      academicYear: school.academic_year,
      studentCount: studentCount.get(school.id) ?? 0,
      feesCollected: fees.get(school.id) ?? 0,
      createdAt: school.created_at,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
