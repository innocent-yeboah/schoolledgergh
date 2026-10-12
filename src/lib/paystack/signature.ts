import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const digest = createHmac("sha512", secret).update(rawBody).digest("hex");
  const actual = Buffer.from(digest);
  const expected = Buffer.from(signature);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
