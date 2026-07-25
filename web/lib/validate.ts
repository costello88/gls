export const SUPPORTED_COUNTRIES = new Set(["BE", "NL", "LU"]);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const PHONE_PATTERNS: Record<string, RegExp> = {
  BE: /^(\+32|0032|0)\d{8,9}$/,
  NL: /^(\+31|0031|0)\d{9}$/,
  LU: /^(\+352|00352)\d{6,9}$/,
};

export function validateEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email.trim());
}

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\-().]/g, "");
}

export function validatePhone(phone: string, countryCode: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  const pattern = PHONE_PATTERNS[countryCode];
  if (!pattern) return false;
  return pattern.test(normalized);
}

export function validateCountry(countryCode: string): boolean {
  return SUPPORTED_COUNTRIES.has(countryCode);
}

export interface OrderCheckInput {
  email: string;
  phone: string;
  countryCode: string;
}

export function checkOrder(order: OrderCheckInput): string[] {
  const reasons: string[] = [];
  if (!validateEmail(order.email)) {
    reasons.push("Email: ongeldig of ontbrekend");
  }
  if (!validatePhone(order.phone, order.countryCode)) {
    reasons.push("Telefoon: ongeldig formaat");
  }
  if (!validateCountry(order.countryCode)) {
    reasons.push("Land: niet ondersteund (verwacht BE, NL of LU)");
  }
  return reasons;
}
