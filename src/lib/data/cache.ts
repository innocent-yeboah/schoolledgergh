import type { LedgerSnapshot } from "@/lib/types";

const PREFIX = "slgh.cache.v1.";
const LAST_USER = "slgh.cache.last-user";

export function writeLedgerCache(userId: string, snapshot: LedgerSnapshot): void {
  localStorage.setItem(`${PREFIX}${userId}`, JSON.stringify(snapshot));
  localStorage.setItem(LAST_USER, userId);
}

export function readLastLedgerCache(): { userId: string; snapshot: LedgerSnapshot } | null {
  const userId = localStorage.getItem(LAST_USER);
  if (!userId) return null;
  const snapshot = readLedgerCache(userId);
  return snapshot ? { userId, snapshot } : null;
}

export function readLedgerCache(userId: string): LedgerSnapshot | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LedgerSnapshot;
    if (!parsed || !Array.isArray(parsed.students) || !Array.isArray(parsed.payments)) return null;
    return parsed;
  } catch {
    return null;
  }
}
