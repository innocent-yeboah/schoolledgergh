import { roundMoney } from "@/lib/format";

export function cedisToPesewas(cedis: number): number {
  return Math.round(roundMoney(cedis) * 100);
}

export function pesewasToCedis(pesewas: number): number {
  if (!Number.isFinite(pesewas)) return Number.NaN;
  return roundMoney(pesewas / 100);
}

export function accraPaidOn(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
