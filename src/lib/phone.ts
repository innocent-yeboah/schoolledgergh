export function toGhInternational(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return null;
}

export function whatsAppLink(phone: string, text: string): string | null {
  const international = toGhInternational(phone);
  if (!international) return null;
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

export function whatsAppShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
