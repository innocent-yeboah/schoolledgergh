import { fillTemplate } from "@/lib/domain";

export const SMS_MAX_LENGTH = 480;

export function personaliseReminder(template: string, vars: Record<string, string>): string {
  const source = template.includes("{payment_link}")
    ? template
    : `${template.trim()}\nPay with mobile money: {payment_link}`;
  return fillTemplate(source, vars).trim();
}
