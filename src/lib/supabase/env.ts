export function publicSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function supportWhatsApp(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "") || "233530710628";
}

export function supportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";
}
