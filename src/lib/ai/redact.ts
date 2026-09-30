/**
 * Strips personal contact details and secrets from text before it is sent to an
 * AI provider. The assistants never need a phone number, an email address or a
 * delivery code to give advice, so they never see one.
 */
const PATTERNS: [RegExp, string][] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  // International or local phone numbers: 7+ digits with optional separators.
  [/(?<![\w])\+?\d[\d\s().-]{6,}\d(?![\w])/g, "[phone]"],
  // Delivery / verification codes written as "code 123456" or "OTP: 1234".
  [/\b(?:code|otp|pin)\b\s*(?:is|:)?\s*\d{4,8}\b/gi, "[code]"],
];

export function redact(input: string): string {
  let out = input;
  for (const [re, label] of PATTERNS) out = out.replace(re, label);
  return out;
}

/** Collapses whitespace runs and cuts to `max` characters so one request can't carry a novel. */
export function clip(input: string, max: number): string {
  const tidy = input.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return tidy.length > max ? `${tidy.slice(0, max)}…` : tidy;
}
