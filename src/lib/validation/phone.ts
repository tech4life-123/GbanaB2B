/**
 * Phone-number normalisation. GbanaB2B identity is phone-first because
 * Liberian commerce runs on mobile numbers. Everything is stored in E.164.
 *
 * Liberian mobile numbers: +231 followed by a 9-digit national number whose
 * first digit is 5, 7 or 8 (e.g. 077…, 088…, 055… when dialled locally).
 * We deliberately do NOT infer the mobile operator from the prefix: number
 * portability and new ranges make that unreliable, and payments will ask the
 * user to choose their wallet explicitly (Phase 5).
 */

export const LIBERIA_CALLING_CODE = "231";

export type PhoneParseResult =
  | { ok: true; e164: string; national: string; isLiberian: boolean }
  | { ok: false; error: string };

const LIBERIAN_MOBILE = /^[578]\d{8}$/;
const GENERIC_E164 = /^[1-9]\d{7,14}$/;

export function normalizePhone(input: string): PhoneParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter your phone number." };

  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) {
    return { ok: false, error: "Phone numbers can only contain digits." };
  }

  // International dialling prefix (00231…) → treat like +231…
  if (!hasPlus && digits.startsWith("00")) digits = digits.slice(2);

  const looksInternational = hasPlus || trimmed.startsWith("00");

  if (looksInternational && !digits.startsWith(LIBERIA_CALLING_CODE)) {
    if (!GENERIC_E164.test(digits)) {
      return { ok: false, error: "That doesn't look like a valid international number." };
    }
    return { ok: true, e164: `+${digits}`, national: digits, isLiberian: false };
  }

  let national = digits;
  if (looksInternational || (digits.startsWith(LIBERIA_CALLING_CODE) && digits.length === 12)) {
    national = digits.slice(LIBERIA_CALLING_CODE.length);
  }
  // Local trunk prefix: 0770 123 456 → 770123456
  if (national.startsWith("0")) national = national.slice(1);

  if (!LIBERIAN_MOBILE.test(national)) {
    return {
      ok: false,
      error: "Enter a Liberian mobile number, e.g. 077 012 3456 or 088 012 3456.",
    };
  }

  return { ok: true, e164: `+${LIBERIA_CALLING_CODE}${national}`, national, isLiberian: true };
}

/** "+231770123456" → "+231 77 012 3456" for display. */
export function formatPhoneForDisplay(e164: string): string {
  const m = /^\+231(\d{2})(\d{3})(\d{4})$/.exec(e164);
  if (m) return `+231 ${m[1]} ${m[2]} ${m[3]}`;
  return e164;
}

/** Masks all but the last 4 digits — for confirmations and logs. */
export function maskPhone(e164: string): string {
  if (e164.length <= 4) return e164;
  return `${e164.slice(0, 4)}${"•".repeat(Math.max(0, e164.length - 8))}${e164.slice(-4)}`;
}
