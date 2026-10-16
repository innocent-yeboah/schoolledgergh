import { createClient } from "@/lib/supabase/client";

export const RESET_EMAIL_SENT =
  "If an account exists for this email, we've sent a reset link. Check your inbox and spam.";

export const LINK_EXPIRED_MESSAGE = "That reset link has expired. Request a new one.";

export const PASSWORD_UPDATED_NOTICE = "password-updated";

export const PASSWORD_UPDATED_MESSAGE = "Your password has been updated.";

const MIN_PASSWORD_LENGTH = 8;

export function friendlyAuth(message: string): string {
  if (message.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (message.includes("Email not confirmed")) return "Confirm your email before signing in.";
  if (message.toLowerCase().includes("rate limit")) return "Too many attempts. Wait a few minutes and try again.";
  return message;
}

export function loginErrorFromQuery(code: string | null): string | null {
  if (code === "link_expired") return LINK_EXPIRED_MESSAGE;
  return null;
}

export function passwordResetRedirect(origin: string): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${base}/auth/callback?next=/reset-password`;
}

export function passwordUpdatedFromSearch(search: string): { message: string | null; nextSearch: string } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.get("notice") !== PASSWORD_UPDATED_NOTICE) return { message: null, nextSearch: "" };
  params.delete("notice");
  const next = params.toString();
  return { message: PASSWORD_UPDATED_MESSAGE, nextSearch: next ? `?${next}` : "" };
}

export function resetPasswordFieldErrors(password: string, confirm: string): { password?: string; confirm?: string } {
  const errors: { password?: string; confirm?: string } = {};
  if (!password) errors.password = "Enter a new password.";
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = "Password must be at least 8 characters.";
  if (!confirm) errors.confirm = "Confirm your new password.";
  else if (password !== confirm) errors.confirm = "Passwords do not match.";
  return errors;
}

export async function sendPasswordReset(email: string, origin: string): Promise<void> {
  const supabase = createClient();
  const redirectTo = passwordResetRedirect(origin);
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(friendlyAuth(error.message));
}

export async function hasAuthSession(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return false;
    return true;
  } catch {
    return false;
  }
}

export async function updatePassword(password: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendlyAuth(error.message));
}
