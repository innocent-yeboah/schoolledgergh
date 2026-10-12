export type AppMode = "demo-school" | "demo-admin" | "live";

export function readAppMode(): AppMode {
  if (typeof document === "undefined") return "live";
  const match = document.cookie.match(/(?:^|;\s*)slgh_mode=([^;]*)/);
  if (match?.[1] === "school") return "demo-school";
  if (match?.[1] === "admin") return "demo-admin";
  return "live";
}

export function writeAppMode(mode: "school" | "admin" | null): void {
  if (mode) {
    document.cookie = `slgh_mode=${mode}; Path=/; Max-Age=2592000; SameSite=Lax`;
    return;
  }
  document.cookie = "slgh_mode=; Path=/; Max-Age=0; SameSite=Lax";
}

const PENDING_KEY = "slgh.pending-school.v1";

export type PendingSchool = {
  name: string;
  adminName: string;
  phone: string;
  email: string;
  term: string;
  academicYear: string;
};

export function savePendingSchool(school: PendingSchool): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(school));
}

export function readPendingSchool(): PendingSchool | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSchool;
    if (!parsed?.name || !parsed.term || !parsed.academicYear) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSchool(): void {
  localStorage.removeItem(PENDING_KEY);
}
