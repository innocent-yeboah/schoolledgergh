import { createClient } from "@/lib/supabase/client";

export function friendlyAuth(message: string): string {
  if (message.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (message.includes("Email not confirmed")) return "Confirm your email before signing in.";
  if (message.toLowerCase().includes("rate limit")) return "Too many attempts. Wait a few minutes and try again.";
  return message;
}

export async function sendPasswordReset(email: string, origin: string): Promise<void> {
  const supabase = createClient();
  const redirectTo = new URL("/auth/callback", origin).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(friendlyAuth(error.message));
}
