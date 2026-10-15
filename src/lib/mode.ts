export type AppMode = "demo-school" | "demo-admin" | "live";

const DEMO_COOKIE = "slgh_mode";

export function demoModeEnabled(flag: string | undefined = process.env.NEXT_PUBLIC_DEMO_MODE): boolean {
  return flag === "true";
}

export function activeDemoCookie(value: string | undefined, enabled = demoModeEnabled()): "" | "school" | "admin" {
  if (!enabled) return "";
  if (value === "school" || value === "admin") return value;
  return "";
}

export function appModeFromCookie(value: string | undefined, enabled = demoModeEnabled()): AppMode {
  const demo = activeDemoCookie(value, enabled);
  if (demo === "school") return "demo-school";
  if (demo === "admin") return "demo-admin";
  return "live";
}

export function demoModeCookie(mode: "school" | "admin" | null, enabled = demoModeEnabled()): string {
  if (mode && enabled) return `${DEMO_COOKIE}=${mode}; Path=/; Max-Age=2592000; SameSite=Lax`;
  return `${DEMO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readAppMode(): AppMode {
  if (typeof document === "undefined") return "live";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${DEMO_COOKIE}=([^;]*)`));
  return appModeFromCookie(match?.[1]);
}

export function writeAppMode(mode: "school" | "admin" | null): void {
  if (typeof document === "undefined") return;
  document.cookie = demoModeCookie(mode);
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
