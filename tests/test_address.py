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


def test_address2_used_as_house_number_when_address1_has_none():
    assert split_address("Boekweitveld", "11") == ("Boekweitveld", "11")


def test_address2_house_number_with_letter_addition_normalized():
    assert split_address("Kerkstraat", "11 a") == ("Kerkstraat", "11A")


def test_address2_house_number_with_bus_addition():
    assert split_address("Kerkstraat", "11 bus 3") == ("Kerkstraat", "11 bus 3")


def test_address2_letter_addition_attached_to_existing_house_number():
    assert split_address("Kerkstraat 12", "A") == ("Kerkstraat", "12A")


def test_address2_bus_addition_attached_to_existing_house_number():
    assert split_address("Kerkstraat 12", "bus 3") == ("Kerkstraat", "12 bus 3")


def test_empty_address2_does_not_change_existing_behavior():
    assert split_address("Kerkstraat 12", "") == ("Kerkstraat", "12")
    assert split_address("Kerkstraat 12") == ("Kerkstraat", "12")
