/**
 * Small shared helpers. Kept dependency-free and locale-tolerant.
 */

/**
 * Parse a Cardmarket quantity display string into an integer.
 * Handles plain ("15"), space-grouped ("1 500") and comma-grouped ("1,500").
 * Returns 0 when no digit can be extracted.
 */
export function parseQty(s: string | null | undefined): number {
  if (!s) return 0;
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse a Cardmarket price display string ("0,02 €", "1 234,56 €") into a
 * float in euros. Returns null when it cannot be parsed.
 */
export function parsePrice(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/\u00a0/g, ' ').match(/([\d\s.,]+)\s*€/);
  if (!m) return null;
  let num = m[1]!.trim().replace(/\s+/g, '');
  // Cardmarket uses a comma as decimal separator.
  if (num.includes(',')) num = num.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(num);
  return Number.isFinite(n) ? n : null;
}

export function normalizeName(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export function parsePriceValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const raw = value.replace(/\u00a0/g, ' ').replace(/\s+/g, '');
  if (!raw) return null;
  if (raw.includes('€')) return parsePrice(value);
  const num = raw.includes(',') ? raw.replace(/\./g, '').replace(/,/g, '.') : raw;
  if (!/^\d+(\.\d+)?$/.test(num)) return null;
  const n = parseFloat(num);
  return Number.isFinite(n) ? n : null;
}