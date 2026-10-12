function encode(value: string): string {
  return encodeURIComponent(value);
}

/** One message to many parents. Addresses go in BCC, never in the To header. */
export function bulkBccMailto(input: { bcc: string[]; subject: string; body: string }): string {
  const addresses = input.bcc.map((email) => email.trim()).filter(Boolean);
  const params = [
    addresses.length ? `bcc=${addresses.map(encode).join(",")}` : "",
    input.subject ? `subject=${encode(input.subject)}` : "",
    input.body ? `body=${encode(input.body)}` : "",
  ].filter(Boolean);
  return `mailto:?${params.join("&")}`;
}

/** A single parent is the only address on the message. */
export function individualMailto(input: { to: string; subject: string; body: string }): string {
  const to = input.to.trim();
  const params = [
    input.subject ? `subject=${encode(input.subject)}` : "",
    input.body ? `body=${encode(input.body)}` : "",
  ].filter(Boolean);
  const query = params.length ? `?${params.join("&")}` : "";
  return `mailto:${encode(to)}${query}`;
}
