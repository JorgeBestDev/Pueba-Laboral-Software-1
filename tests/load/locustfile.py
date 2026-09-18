"""Repeatable baseline load profile for a disposable Vokter test environment.

Run with: locust -f tests/load/locustfile.py --host http://127.0.0.1:5000
Never point this profile at production without an approved traffic budget.
"""

from uuid import uuid4

from locust import HttpUser, between, task


class StorefrontVisitor(HttpUser):
    """Anonymous browsing and cart activity, the most common storefront path."""

    wait_time = between(1, 3)

    def on_start(self) -> None:
        self.session_key = f"load-{uuid4()}"

    @task(6)
    def browse_catalog(self) -> None:
        self.client.get("/api/v1/catalog/products?sort=newest&page=1", name="catalog/products")

    @task(2)
    def browse_filters(self) -> None:
        self.client.get("/api/v1/catalog/categories", name="catalog/categories")
        self.client.get("/api/v1/catalog/filters", name="catalog/filters")

    @task(1)
    def create_anonymous_cart(self) -> None:
        self.client.post(
            "/api/v1/carts",
            json={"session_key": self.session_key},
            headers={"X-Cart-Session": self.session_key},
            name="carts/create",
        )
