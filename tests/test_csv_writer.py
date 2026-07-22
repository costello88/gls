import csv
from gls_sync.csv_writer import PENDING_COLUMNS, REVIEW_COLUMNS, append_row


def test_pending_columns_order():
    assert PENDING_COLUMNS == [
        "Naam", "Bedrijf", "Straat", "Huisnummer", "Postcode", "Plaats",
        "Land", "Telefoon", "Email", "Referentie", "Gewicht", "Aantal colli",
    ]


def test_review_columns_adds_reden():
    assert REVIEW_COLUMNS == PENDING_COLUMNS + ["Reden"]


def test_append_row_creates_file_with_header(tmp_path):
    path = tmp_path / "pending_import.csv"
    row = {col: f"v-{col}" for col in PENDING_COLUMNS}
    append_row(path, row, PENDING_COLUMNS)

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == PENDING_COLUMNS
        rows = list(reader)
    assert len(rows) == 1
    assert rows[0]["Naam"] == "v-Naam"


def test_append_row_appends_without_duplicating_header(tmp_path):
    path = tmp_path / "pending_import.csv"
    row1 = {col: "1" for col in PENDING_COLUMNS}
    row2 = {col: "2" for col in PENDING_COLUMNS}
    append_row(path, row1, PENDING_COLUMNS)
    append_row(path, row2, PENDING_COLUMNS)

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) == 2
    assert [r["Naam"] for r in rows] == ["1", "2"]


def test_append_row_missing_keys_default_to_empty_string(tmp_path):
    path = tmp_path / "needs_review.csv"
    row = {"Naam": "Jan", "Reden": "Email: ongeldig of ontbrekend"}
    append_row(path, row, REVIEW_COLUMNS)

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert rows[0]["Bedrijf"] == ""
    assert rows[0]["Reden"] == "Email: ongeldig of ontbrekend"
