from dataclasses import dataclass
from pathlib import Path

from gls_sync.address import split_address
from gls_sync.csv_writer import PENDING_COLUMNS, REVIEW_COLUMNS, append_row
from gls_sync.state import SyncState
from gls_sync.validate import check_row


PACKAGE_CODE = "PCO"


@dataclass
class SyncResult:
    new: int = 0
    valid: int = 0
    invalid: int = 0
    error: str | None = None


def order_to_row(order: dict, weight_kg: float) -> dict:
    shipping = order.get("shipping_address") or {}
    street, house_number = split_address(shipping.get("address1", ""), shipping.get("address2", ""))
    customer = order.get("customer") or {}
    email = order.get("contact_email") or customer.get("email", "")
    phone = shipping.get("phone") or customer.get("phone", "")
    return {
        "Naam": shipping.get("name", ""),
        "Bedrijf": shipping.get("company", ""),
        "Straat": street,
        "Huisnummer": house_number,
        "Postcode": shipping.get("zip", ""),
        "Plaats": shipping.get("city", ""),
        "Land": shipping.get("country_code", ""),
        "Telefoon": phone,
        "Email": email,
        "Referentie": order.get("name", ""),
        "Gewicht": str(weight_kg),
        "Aantal colli": "1",
        "Verpakking": PACKAGE_CODE,
    }


def run_sync_tick(client, state: SyncState, base_dir: Path, weight_kg: float) -> SyncResult:
    try:
        orders = client.fetch_paid_unfulfilled_orders()
    except Exception as exc:
        return SyncResult(error=str(exc))

    result = SyncResult()
    for order in orders:
        order_id = order["id"]
        if state.is_processed(order_id):
            continue
        result.new += 1
        row = order_to_row(order, weight_kg)
        reasons = check_row(row)
        if reasons:
            row["Reden"] = "; ".join(reasons)
            append_row(base_dir / "needs_review.csv", row, REVIEW_COLUMNS)
            result.invalid += 1
        else:
            append_row(base_dir / "pending_import.csv", row, PENDING_COLUMNS)
            result.valid += 1
        state.mark_processed(order_id)
    return result
