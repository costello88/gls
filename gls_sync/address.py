import re

_HOUSE_NUMBER_RE = re.compile(
    r"^(?P<street>.+?\S)\s+(?P<number>\d+[A-Za-z]?(?:\s+bus\s+\d+)?)\s*$"
)
_LETTER_ADDITION_RE = re.compile(r"^[A-Za-z]$")
_BUS_ADDITION_RE = re.compile(r"^bus\s*(\d+)$", re.IGNORECASE)
_NUMBER_LETTER_RE = re.compile(r"^(\d+)\s*([A-Za-z])$")


def _format_addition(raw: str) -> str:
    raw = raw.strip()
    if _LETTER_ADDITION_RE.match(raw):
        return raw.upper()
    bus_match = _BUS_ADDITION_RE.match(raw)
    if bus_match:
        return f"bus {bus_match.group(1)}"
    number_letter_match = _NUMBER_LETTER_RE.match(raw)
    if number_letter_match:
        return f"{number_letter_match.group(1)}{number_letter_match.group(2).upper()}"
    return raw


def split_address(address1: str, address2: str = "") -> tuple[str, str]:
    address1 = (address1 or "").strip()
    address2 = (address2 or "").strip()

    match = _HOUSE_NUMBER_RE.match(address1)
    if match:
        street, house_number = match.group("street"), match.group("number")
    else:
        street, house_number = address1, ""

    if not address2:
        return street, house_number

    addition = _format_addition(address2)
    if not house_number:
        return street, addition
    if addition.lower().startswith("bus"):
        return street, f"{house_number} {addition}"
    return street, f"{house_number}{addition}"
