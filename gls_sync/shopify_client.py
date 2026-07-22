import re
import requests

API_VERSION = "2024-10"
_NEXT_LINK_RE = re.compile(r'<([^>]+)>;\s*rel="next"')


class ShopifyClient:
    def __init__(self, shop_domain: str, access_token: str, session=None):
        self.shop_domain = shop_domain
        self.access_token = access_token
        self.session = session or requests.Session()

    def _headers(self) -> dict:
        return {"X-Shopify-Access-Token": self.access_token}

    def fetch_paid_unfulfilled_orders(self) -> list[dict]:
        url = f"https://{self.shop_domain}/admin/api/{API_VERSION}/orders.json"
        params = {
            "financial_status": "paid",
            "fulfillment_status": "unfulfilled",
            "status": "any",
            "limit": 250,
        }
        orders: list[dict] = []
        while url:
            response = self.session.get(url, headers=self._headers(), params=params, timeout=30)
            response.raise_for_status()
            orders.extend(response.json().get("orders", []))
            link = response.headers.get("Link", "")
            match = _NEXT_LINK_RE.search(link)
            url = match.group(1) if match else None
            params = None
        return orders
