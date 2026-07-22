import re

SUPPORTED_COUNTRIES = frozenset({"BE", "NL", "LU"})

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_PHONE_PATTERNS = {
    "BE": re.compile(r"^(\+32|0032|0)\d{8,9}$"),
    "NL": re.compile(r"^(\+31|0031|0)\d{9}$"),
    "LU": re.compile(r"^(\+352|00352)\d{6,9}$"),
}


def validate_email(email: str) -> bool:
    if not email:
        return False
    return bool(_EMAIL_RE.match(email.strip()))


def _normalize_phone(phone: str) -> str:
    return re.sub(r"[\s\-().]", "", phone.strip())


def validate_phone(phone: str, country_code: str) -> bool:
    if not phone:
        return False
    normalized = _normalize_phone(phone)
    pattern = _PHONE_PATTERNS.get(country_code)
    if pattern is None:
        return False
    return bool(pattern.match(normalized))


def validate_country(country_code: str) -> bool:
    return country_code in SUPPORTED_COUNTRIES


def check_row(row: dict) -> list[str]:
    reasons = []
    if not validate_email(row.get("Email", "")):
        reasons.append("Email: ongeldig of ontbrekend")
    land = row.get("Land", "")
    if not validate_phone(row.get("Telefoon", ""), land):
        reasons.append("Telefoon: ongeldig formaat")
    if not validate_country(land):
        reasons.append("Land: niet ondersteund (verwacht BE, NL of LU)")
    return reasons
