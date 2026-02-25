/**
 * Phone number validation utilities.
 *
 * E.164 format: + followed by country code + number, 8–15 digits total.
 * Examples: +917041668245  +12125551234  +447911123456
 */

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Normalise a raw phone string and validate it as E.164.
 *
 * - Strips spaces, dashes, dots, brackets
 * - Prepends "+" if missing
 * - Validates the resulting string against E.164 regex
 *
 * @param {string} raw - Raw phone input from user / CSV
 * @returns {{ phone: string } | { error: string }}
 */
export function validatePhone(raw) {
  // Strip common separators
  let phone = String(raw ?? "").replace(/[\s\-().]/g, "");

  // Prepend + if the user omitted it
  if (!phone.startsWith("+")) phone = "+" + phone;

  if (!E164_REGEX.test(phone)) {
    return {
      error:
        'Invalid phone number. Must be E.164 format, e.g. +917041668245 or +12125551234 (country code required).',
    };
  }

  return { phone };
}

/**
 * Check a normalised E.164 number against the VAPI_ALLOWED_PREFIXES env var.
 *
 * VAPI_ALLOWED_PREFIXES is a comma-separated list of dialling prefixes,
 * e.g. "+91" or "+1,+44".  Leave it empty to allow all prefixes.
 *
 * @param {string} phone - Already-normalised E.164 number
 * @returns {{ error: string } | null}  null = OK
 */
export function checkAllowedPrefix(phone) {
  const raw = String(process.env.VAPI_ALLOWED_PREFIXES ?? "").trim();
  if (!raw) return null; // No restriction configured → allow all

  const prefixes = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowed = prefixes.some((prefix) => phone.startsWith(prefix));
  if (!allowed) {
    return {
      error: `Number is outside your allowed calling region. Must start with: ${prefixes.join(", ")}. Check VAPI_ALLOWED_PREFIXES in your .env file.`,
    };
  }

  return null;
}
