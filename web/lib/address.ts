const HOUSE_NUMBER_RE = /^(.+?\S)\s+(\d+[A-Za-z]?(?:\s+bus\s+\d+)?)\s*$/;
const LETTER_ADDITION_RE = /^[A-Za-z]$/;
const BUS_ADDITION_RE = /^bus\s*(\d+)$/i;
const NUMBER_LETTER_RE = /^(\d+)\s*([A-Za-z])$/;

function formatAddition(raw: string): string {
  const trimmed = raw.trim();
  if (LETTER_ADDITION_RE.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const busMatch = trimmed.match(BUS_ADDITION_RE);
  if (busMatch) {
    return `bus ${busMatch[1]}`;
  }
  const numberLetterMatch = trimmed.match(NUMBER_LETTER_RE);
  if (numberLetterMatch) {
    return `${numberLetterMatch[1]}${numberLetterMatch[2].toUpperCase()}`;
  }
  return trimmed;
}

export function splitAddress(
  address1: string,
  address2: string = "",
): { street: string; houseNo: string } {
  const a1 = (address1 ?? "").trim();
  const a2 = (address2 ?? "").trim();

  const match = a1.match(HOUSE_NUMBER_RE);
  const street = match ? match[1] : a1;
  const houseNo = match ? match[2] : "";

  if (!a2) {
    return { street, houseNo };
  }

  const addition = formatAddition(a2);
  if (!houseNo) {
    return { street, houseNo: addition };
  }
  if (addition.toLowerCase().startsWith("bus")) {
    return { street, houseNo: `${houseNo} ${addition}` };
  }
  return { street, houseNo: `${houseNo}${addition}` };
}
