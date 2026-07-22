from gls_sync.shopify_client import ShopifyClient
from tests.fixtures.orders import make_order


class FakeResponse:
    def __init__(self, json_data, link_header=None):
        self._json_data = json_data
        self.headers = {"Link": link_header} if link_header else {}

    def raise_for_status(self):
        pass

    def json(self):
        return self._json_data


class FakeSession:
    def __init__(self, pages):
        self.pages = pages
        self.requests = []

    def get(self, url, headers=None, params=None, timeout=None):
        self.requests.append({"url": url, "params": params, "headers": headers})
        page = self.pages[len(self.requests) - 1]
        return page


def test_fetch_single_page():
    order = make_order()
    session = FakeSession([FakeResponse({"orders": [order]})])
    client = ShopifyClient("example.myshopify.com", "shpat_test", session=session)

    orders = client.fetch_paid_unfulfilled_orders()

    assert orders == [order]
    assert session.requests[0]["params"]["financial_status"] == "paid"
    assert session.requests[0]["params"]["fulfillment_status"] == "unfulfilled"


def test_fetch_follows_pagination_link():
    order1 = make_order(order_id=1001)
    order2 = make_order(order_id=1002)
    next_url = "https://example.myshopify.com/admin/api/2024-10/orders.json?page_info=abc"
    session = FakeSession(
        [
            FakeResponse({"orders": [order1]}, link_header=f'<{next_url}>; rel="next"'),
            FakeResponse({"orders": [order2]}),
        ]
    )
    client = ShopifyClient("example.myshopify.com", "shpat_test", session=session)

    orders = client.fetch_paid_unfulfilled_orders()

    assert [o["id"] for o in orders] == [1001, 1002]
    assert len(session.requests) == 2


def test_sends_access_token_header():
    session = FakeSession([FakeResponse({"orders": []})])
    client = ShopifyClient("example.myshopify.com", "shpat_test", session=session)
    client.fetch_paid_unfulfilled_orders()
    assert session.requests[0]["headers"]["X-Shopify-Access-Token"] == "shpat_test"
