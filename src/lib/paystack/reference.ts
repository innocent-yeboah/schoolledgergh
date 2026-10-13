export function createPaystackReference(date = new Date()): string {
  const time = date.getTime().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `slgh.${time}.${rand}`;
}

export function receiptEmail(parentEmail: string, schoolEmail: string): string | null {
  const candidate = [parentEmail, schoolEmail].map((value) => value.trim()).find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  return candidate ?? null;
}
