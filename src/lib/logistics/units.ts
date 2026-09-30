/**
 * Unit conversions for logistics fields. The database stores integers
 * (grams, cm³, millimetres) so there is never float drift; sellers type
 * kilograms and centimetres.
 */

export function kgToGrams(input: string): number | null {
  const v = Number(input.replace(/,/g, "").trim());
  if (!Number.isFinite(v) || v <= 0) return null;
  const g = Math.round(v * 1000);
  return g >= 1 && g <= 50_000_000 ? g : null;
}

export function gramsToKgString(g: number | null | undefined): string {
  if (!g) return "";
  return String(Number((g / 1000).toFixed(3)));
}

export function formatWeight(g: number | null | undefined): string {
  if (!g) return "—";
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: g >= 100_000 ? 0 : 2 });
  return g >= 1000 ? `${nf.format(g / 1000)} kg` : `${nf.format(g)} g`;
}

export function cmToMm(input: string): number | null {
  if (!input.trim()) return null;
  const v = Number(input.replace(/,/g, "").trim());
  if (!Number.isFinite(v) || v <= 0) return null;
  const mm = Math.round(v * 10);
  return mm >= 1 && mm <= 100_000 ? mm : null;
}

export function mmToCmString(mm: number | null | undefined): string {
  if (!mm) return "";
  return String(Number((mm / 10).toFixed(1)));
}

/** Volume in cm³ from mm dimensions, or null if any dimension is missing. */
export function volumeFromDimensions(l?: number | null, w?: number | null, h?: number | null): number | null {
  if (!l || !w || !h) return null;
  const cm3 = Math.round((l / 10) * (w / 10) * (h / 10));
  return cm3 >= 1 ? cm3 : null;
}

/** Carrier class for a total cargo weight — matches the platform's small/medium/large bands. */
export function carrierClassFor(totalGrams: number): "Small" | "Medium" | "Large" {
  const kg = totalGrams / 1000;
  if (kg <= 300) return "Small";
  if (kg <= 3000) return "Medium";
  return "Large";
}
