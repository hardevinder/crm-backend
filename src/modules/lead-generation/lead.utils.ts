import type { ContactMethodType } from "@prisma/client";

export function toText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/\.0$/, "").trim();
  return text || null;
}

export function normalizeName(value: unknown): string {
  return (toText(value) || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeState(value: unknown): string {
  const text = normalizeName(value);
  return text || "UNKNOWN";
}

export function normalizePhone(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;

  let digits = text.replace(/[^0-9]/g, "");
  if (!digits) return null;

  // Convert Indian numbers like 919876543210 to 9876543210 for duplicate matching.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  return digits;
}

export function normalizeEmail(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;
  return text.toLowerCase();
}

export function normalizeGeneric(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeContactValue(methodType: ContactMethodType, value: unknown): string | null {
  if (methodType === "MOBILE" || methodType === "WHATSAPP" || methodType === "LANDLINE") {
    return normalizePhone(value);
  }
  if (methodType === "EMAIL") return normalizeEmail(value);
  return normalizeGeneric(value);
}

export function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }

  // Fallback: case-insensitive header matching.
  const normalized = Object.keys(row).reduce<Record<string, string>>((acc, current) => {
    acc[current.toLowerCase().trim()] = current;
    return acc;
  }, {});

  for (const key of keys) {
    const actual = normalized[key.toLowerCase().trim()];
    if (actual && row[actual] !== undefined && row[actual] !== null && String(row[actual]).trim() !== "") {
      return row[actual];
    }
  }

  return null;
}

export function parseNumber(value: unknown): number | null {
  const text = toText(value);
  if (!text) return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseExcelDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = toText(value);
  if (!text) return null;

  // Handles: 15-05-2026 12:01 PM, 15/05/2026, 2026-05-15
  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?$/i);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    let hour = dmy[4] ? Number(dmy[4]) : 0;
    const minute = dmy[5] ? Number(dmy[5]) : 0;
    const ampm = dmy[6]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    const dt = new Date(year, month, day, hour, minute, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function uniqueByNormalized<T extends { normalizedValue: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = item.normalizedValue;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}
