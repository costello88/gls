from gls_sync.address import split_address


def test_simple_number():
    assert split_address("Kerkstraat 12") == ("Kerkstraat", "12")


def test_number_with_letter_suffix():
    assert split_address("Kerkstraat 12A") == ("Kerkstraat", "12A")


def test_number_with_bus_suffix():
    assert split_address("Kerkstraat 12 bus 3") == ("Kerkstraat", "12 bus 3")


def test_no_number_present():
    assert split_address("Onbekende straat") == ("Onbekende straat", "")


def test_leading_number_is_still_the_last_match():
    assert split_address("12 Kerkstraat 34") == ("12 Kerkstraat", "34")
