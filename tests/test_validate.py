from gls_sync.validate import validate_email, validate_phone, validate_country, check_row


def test_validate_email_accepts_valid():
    assert validate_email("klant@voorbeeld.be") is True


def test_validate_email_rejects_missing_at():
    assert validate_email("klantvoorbeeld.be") is False


def test_validate_email_rejects_empty():
    assert validate_email("") is False


def test_validate_phone_accepts_be_international():
    assert validate_phone("+32 470 12 34 56", "BE") is True


def test_validate_phone_accepts_be_local():
    assert validate_phone("0470123456", "BE") is True


def test_validate_phone_accepts_nl_international():
    assert validate_phone("+31 6 12345678", "NL") is True


def test_validate_phone_accepts_lu_international():
    assert validate_phone("+352 621123456", "LU") is True


def test_validate_phone_rejects_too_short():
    assert validate_phone("0470", "BE") is False


def test_validate_phone_rejects_empty():
    assert validate_phone("", "BE") is False


def test_validate_country_accepts_supported():
    assert validate_country("BE") is True
    assert validate_country("NL") is True
    assert validate_country("LU") is True


def test_validate_country_rejects_unsupported():
    assert validate_country("DE") is False


def test_check_row_passes_clean_row():
    row = {"Email": "klant@voorbeeld.be", "Telefoon": "+32470123456", "Land": "BE"}
    assert check_row(row) == []


def test_check_row_flags_bad_email():
    row = {"Email": "kapot", "Telefoon": "+32470123456", "Land": "BE"}
    reasons = check_row(row)
    assert any("Email" in r for r in reasons)


def test_check_row_flags_bad_phone():
    row = {"Email": "klant@voorbeeld.be", "Telefoon": "123", "Land": "BE"}
    reasons = check_row(row)
    assert any("Telefoon" in r for r in reasons)


def test_check_row_flags_unsupported_country():
    row = {"Email": "klant@voorbeeld.be", "Telefoon": "+32470123456", "Land": "DE"}
    reasons = check_row(row)
    assert any("Land" in r for r in reasons)


def test_check_row_flags_multiple_reasons():
    row = {"Email": "kapot", "Telefoon": "123", "Land": "BE"}
    reasons = check_row(row)
    assert len(reasons) == 2
