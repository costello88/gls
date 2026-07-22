import csv
from pathlib import Path

PENDING_COLUMNS = [
    "Naam", "Bedrijf", "Straat", "Huisnummer", "Postcode", "Plaats",
    "Land", "Telefoon", "Email", "Referentie", "Gewicht", "Aantal colli",
]
REVIEW_COLUMNS = PENDING_COLUMNS + ["Reden"]


def append_row(path: Path, row: dict, columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = path.exists()
    with path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns, restval="")
        if not file_exists:
            writer.writeheader()
        writer.writerow({col: row.get(col, "") for col in columns})
