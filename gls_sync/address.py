import re

_HOUSE_NUMBER_RE = re.compile(
    r"^(?P<street>.+?\S)\s+(?P<number>\d+[A-Za-z]?(?:\s+bus\s+\d+)?)\s*$"
)


def split_address(address1: str) -> tuple[str, str]:
    address1 = address1.strip()
    match = _HOUSE_NUMBER_RE.match(address1)
    if not match:
        return address1, ""
    return match.group("street"), match.group("number")
