export type AcademicPeriod = {
  term: string;
  academicYear: string;
};

/**
 * Suggested Ghanaian term for a calendar date. September–December is Term 1 of
 * the year that is starting. January–April is Term 2. May–August is Term 3.
 * The result is only a starting value; each school stores its own period.
 */
export function suggestedAcademicPeriod(date: Date): AcademicPeriod {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month >= 8) {
    return { term: "Term 1", academicYear: `${year}/${year + 1}` };
  }
  if (month <= 3) {
    return { term: "Term 2", academicYear: `${year - 1}/${year}` };
  }
  return { term: "Term 3", academicYear: `${year - 1}/${year}` };
}

export function assertAcademicPeriod(term: string, academicYear: string): void {
  const cleanTerm = term.trim();
  const cleanYear = academicYear.trim();
  if (!cleanTerm || !cleanYear) {
    throw new Error("Enter both the term and the academic year before saving.");
  }
  if (cleanTerm.length > 40 || cleanYear.length > 32) {
    throw new Error("Term or academic year is too long.");
  }
}

export function periodLabel(term: string, academicYear: string): string {
  const cleanTerm = term.trim();
  const cleanYear = academicYear.trim();
  if (!cleanTerm || !cleanYear) return "Set term in Settings";
  return `${cleanTerm} · ${cleanYear}`;
}
