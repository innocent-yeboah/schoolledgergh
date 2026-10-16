export function isAllowlistedAdmin(email: string | null | undefined, raw = process.env.ADMIN_EMAILS): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  const allow = (raw ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(normalized);
}
