import unittest
from decimal import Decimal

from app import create_app, db
from app.models import (
    Address,
    AuthSession,
    Category,
    Order,
    OrderStatus,
    Product,
    ProductVariant,
    User,
    UserRole,
)


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app("testing")
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        product = Product(name="Test product", slug="test-product", base_price=Decimal("10.00"))
        product.variants.append(
            ProductVariant(
                sku="TEST-001",
                name="Default",
                price=Decimal("10.00"),
                stock_quantity=3,
            )
        )
        db.session.add(product)
        db.session.commit()
        self.variant = product.variants[0]
        self.client = self.app.test_client()

    def register(self, email: str, first_name: str = "Test") -> dict:
        response = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "password1",
                "first_name": first_name,
                "last_name": "User",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()["data"]

    def auth_headers(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def make_admin(self, email: str) -> str:
        user = db.session.query(User).filter_by(email=email).one()
        user.role = UserRole.ADMIN
        db.session.commit()
        return self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "password1"},
        ).get_json()["data"]["access_token"]

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_authenticated_cart_is_private(self):
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "password1",
                "first_name": "Test",
                "last_name": "User",
            },
        )
        token = registration.get_json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        cart = self.client.post("/api/v1/carts", headers=headers, json={})
        cart_id = cart.get_json()["data"]["id"]

        self.assertEqual(self.client.get(f"/api/v1/carts/{cart_id}").status_code, 401)
        self.assertEqual(
            self.client.post(
                f"/api/v1/carts/{cart_id}/items",
                headers=headers,
                json={"variant_id": self.variant.id, "quantity": 1},
            ).status_code,
            201,
        )

    def test_anonymous_cart_creation_is_idempotent_by_session_key(self):
        first = self.client.post("/api/v1/carts", json={"session_key": "same-session"})
        second = self.client.post("/api/v1/carts", json={"session_key": "same-session"})
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.get_json()["data"]["id"], second.get_json()["data"]["id"])

    def test_checkout_creates_order_and_decreases_stock(self):
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "buyer@example.com",
                "password": "password1",
                "first_name": "Buyer",
                "last_name": "User",
            },
        )
        headers = {
            "Authorization": f"Bearer {registration.get_json()['data']['access_token']}"
        }
        cart = self.client.post("/api/v1/carts", headers=headers, json={}).get_json()["data"]
        self.client.post(
            f"/api/v1/carts/{cart['id']}/items",
            headers=headers,
            json={"variant_id": self.variant.id, "quantity": 2},
        )
        checkout = self.client.post(
            "/api/v1/orders/checkout",
            headers={**headers, "Idempotency-Key": "checkout-test-001"},
            json={"cart_id": cart["id"], "shipping_address": "Test address"},
        )

        self.assertEqual(checkout.status_code, 201)
        order_data = checkout.get_json()["data"]
        self.assertEqual(order_data["total"], "20.00")
        self.assertEqual(order_data["payment"]["status"], "pending")
        self.assertEqual(order_data["payment"]["method"], "card")
        self.assertEqual(order_data["shipment"]["status"], "pending")
        self.assertEqual(db.session.get(ProductVariant, self.variant.id).stock_quantity, 1)

    def test_checkout_requires_idempotency_key(self):
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "key@example.com",
                "password": "password1",
                "first_name": "Key",
                "last_name": "User",
            },
        )
        token = registration.get_json()["data"]["access_token"]
        headers = {"Authorization": "Bearer " + token}
        cart = self.client.post("/api/v1/carts", headers=headers, json={}).get_json()["data"]
        response = self.client.post(
            "/api/v1/orders/checkout",
            headers=headers,
            json={"cart_id": cart["id"], "shipping_address": "Test address"},
        )
        self.assertEqual(response.status_code, 400)

    def test_checkout_is_idempotent(self):
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "idempotent@example.com",
                "password": "password1",
                "first_name": "Idempotent",
                "last_name": "User",
            },
        )
        token = registration.get_json()["data"]["access_token"]
        headers = {
            "Authorization": "Bearer " + token,
            "Idempotency-Key": "checkout-retry-001",
        }
        cart = self.client.post("/api/v1/carts", headers=headers, json={}).get_json()["data"]
        self.client.post(
            f"/api/v1/carts/{cart['id']}/items",
            headers=headers,
            json={"variant_id": self.variant.id, "quantity": 1},
        )
        first = self.client.post(
            "/api/v1/orders/checkout",
            headers=headers,
            json={"cart_id": cart["id"], "shipping_address": "Test address"},
        )
        second = self.client.post(
            "/api/v1/orders/checkout",
            headers=headers,
            json={"cart_id": cart["id"], "shipping_address": "Changed address"},
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.get_json()["data"]["id"], second.get_json()["data"]["id"])
        self.assertEqual(db.session.query(ProductVariant).one().stock_quantity, 2)

    def test_user_has_one_current_cart_and_can_clear_it(self):
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "cart@example.com",
                "password": "password1",
                "first_name": "Cart",
                "last_name": "User",
            },
        )
        token = registration.get_json()["data"]["access_token"]
        headers = {"Authorization": "Bearer " + token}
        first = self.client.post("/api/v1/carts", headers=headers, json={}).get_json()["data"]
        second = self.client.post("/api/v1/carts", headers=headers, json={}).get_json()["data"]
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(self.client.get("/api/v1/carts/current", headers=headers).status_code, 200)
        self.client.post(
            f"/api/v1/carts/{first['id']}/items",
            headers=headers,
            json={"variant_id": self.variant.id, "quantity": 1},
        )
        cleared = self.client.delete(
            f"/api/v1/carts/{first['id']}/items", headers=headers
        )
        self.assertEqual(cleared.status_code, 200)
        self.assertEqual(cleared.get_json()["data"]["items"], [])

    def test_refresh_token_rotates_and_revokes_previous_token(self):
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "refresh@example.com",
                "password": "password1",
                "first_name": "Refresh",
                "last_name": "User",
            },
        ).get_json()["data"]
        first = self.client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": registration["refresh_token"]},
        )
        self.assertEqual(first.status_code, 200)
        rotated = first.get_json()["data"]["refresh_token"]
        self.assertNotEqual(rotated, registration["refresh_token"])
        reused = self.client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": registration["refresh_token"]},
        )
        self.assertEqual(reused.status_code, 401)
        access_token = first.get_json()["data"]["access_token"]
        logout = self.client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": "Bearer " + access_token},
            json={"refresh_token": rotated},
        )
        self.assertEqual(logout.status_code, 204)
        self.assertEqual(
            self.client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": rotated},
            ).status_code,
            401,
        )

    def test_customer_cannot_use_admin_catalog_endpoints(self):
        data = self.register("customer-admin@example.com")
        response = self.client.post(
            "/api/v1/admin/catalog/products",
            headers=self.auth_headers(data["access_token"]),
            json={
                "name": "Forbidden",
                "slug": "forbidden",
                "base_price": "10.00",
            },
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_can_manage_product_variant_and_category(self):
        data = self.register("admin@example.com", "Admin")
        admin_token = self.make_admin("admin@example.com")
        headers = self.auth_headers(admin_token)
        category = self.client.post(
            "/api/v1/admin/catalog/categories",
            headers=headers,
            json={"name": "Shoes", "slug": "shoes"},
        )
        self.assertEqual(category.status_code, 201)
        category_id = category.get_json()["data"]["id"]
        product = self.client.post(
            "/api/v1/admin/catalog/products",
            headers=headers,
            json={
                "name": "Running shoe",
                "slug": "running-shoe",
                "base_price": "80.00",
                "category_ids": [category_id],
            },
        )
        self.assertEqual(product.status_code, 201)
        product_id = product.get_json()["data"]["id"]
        variant = self.client.post(
            f"/api/v1/admin/catalog/products/{product_id}/variants",
            headers=headers,
            json={
                "sku": "RUN-001",
                "name": "Size 42",
                "price": "80.00",
                "stock_quantity": 7,
            },
        )
        self.assertEqual(variant.status_code, 201)
        variant_id = variant.get_json()["data"]["id"]
        updated = self.client.patch(
            f"/api/v1/admin/catalog/variants/{variant_id}",
            headers=headers,
            json={"stock_quantity": 12},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["data"]["stock_quantity"], 12)

    def test_catalog_search_filters_and_slug_detail(self):
        product = self.client.get(
            "/api/v1/catalog/products?q=Test&available=true&sort=price_asc"
        )
        self.assertEqual(product.status_code, 200)
        self.assertIn("meta", product.get_json())
        detail = self.client.get("/api/v1/catalog/products/slug/test-product")
        self.assertEqual(detail.status_code, 200)
        filters = self.client.get("/api/v1/catalog/filters")
        self.assertEqual(filters.status_code, 200)
        self.assertIn("price", filters.get_json()["data"])

    def test_address_snapshot_is_used_by_checkout(self):
        data = self.register("address@example.com")
        headers = self.auth_headers(data["access_token"])
        address = self.client.post(
            "/api/v1/users/me/addresses",
            headers=headers,
            json={
                "label": "Home",
                "street": "First street",
                "city": "Bogota",
                "state": "Cundinamarca",
                "postal_code": "110111",
                "country": "CO",
            },
        )
        self.assertEqual(address.status_code, 201)
        address_id = address.get_json()["data"]["id"]
        cart = self.client.post("/api/v1/carts", headers=headers, json={}).get_json()["data"]
        self.client.post(
            f"/api/v1/carts/{cart['id']}/items",
            headers=headers,
            json={"variant_id": self.variant.id},
        )
        checkout = self.client.post(
            "/api/v1/orders/checkout",
            headers={**headers, "Idempotency-Key": "address-checkout"},
            json={"cart_id": cart["id"], "address_id": address_id},
        )
        self.assertEqual(checkout.status_code, 201)
        self.assertEqual(
            checkout.get_json()["data"]["shipping_address_snapshot"]["city"],
            "Bogota",
        )

    def test_invalid_order_transition_is_rejected(self):
        data = self.register("transition@example.com")
        headers = self.auth_headers(data["access_token"])
        cart = self.client.post("/api/v1/carts", headers=headers, json={}).get_json()["data"]
        self.client.post(
            f"/api/v1/carts/{cart['id']}/items",
            headers=headers,
            json={"variant_id": self.variant.id},
        )
        order = self.client.post(
            "/api/v1/orders/checkout",
            headers={**headers, "Idempotency-Key": "transition-checkout"},
            json={"cart_id": cart["id"], "shipping_address": "Street"},
        ).get_json()["data"]
        admin_token = self.make_admin("transition@example.com")
        response = self.client.patch(
            f"/api/v1/orders/{order['id']}/status",
            headers=self.auth_headers(admin_token),
            json={"status": "completed"},
        )
        self.assertEqual(response.status_code, 409)

    def test_cancel_order_restores_inventory(self):
        data = self.register("cancel@example.com")
        headers = self.auth_headers(data["access_token"])
        cart = self.client.post("/api/v1/carts", headers=headers, json={}).get_json()["data"]
        self.client.post(
            f"/api/v1/carts/{cart['id']}/items",
            headers=headers,
            json={"variant_id": self.variant.id, "quantity": 2},
        )
        order = self.client.post(
            "/api/v1/orders/checkout",
            headers={**headers, "Idempotency-Key": "cancel-checkout"},
            json={"cart_id": cart["id"], "shipping_address": "Street"},
        ).get_json()["data"]
        self.assertEqual(db.session.get(ProductVariant, self.variant.id).stock_quantity, 1)
        response = self.client.post(
            f"/api/v1/orders/{order['id']}/cancel", headers=headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(db.session.get(ProductVariant, self.variant.id).stock_quantity, 3)

    def test_orders_are_paginated(self):
        data = self.register("orders-page@example.com")
        headers = self.auth_headers(data["access_token"])
        response = self.client.get("/api/v1/orders?page=1&per_page=2", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["meta"]["page"], 1)

    def test_reviews_require_purchase_and_return_summary(self):
        data = self.register("review@example.com")
        headers = self.auth_headers(data["access_token"])
        response = self.client.post(
            "/api/v1/social/reviews",
            headers=headers,
            json={"product_id": 1, "rating": 5},
        )
        self.assertEqual(response.status_code, 400)
        listed = self.client.get("/api/v1/social/products/1/reviews?page=1&per_page=5")
        self.assertEqual(listed.status_code, 200)
        self.assertIn("summary", listed.get_json())

    def test_review_with_title_and_content_is_accepted_after_purchase(self):
        data = self.register("verified-review@example.com")
        headers = self.auth_headers(data["access_token"])
        cart = self.client.post("/api/v1/carts", headers=headers, json={}).get_json()["data"]
        self.client.post(
            f"/api/v1/carts/{cart['id']}/items",
            headers=headers,
            json={"variant_id": self.variant.id},
        )
        order = self.client.post(
            "/api/v1/orders/checkout",
            headers={**headers, "Idempotency-Key": "review-checkout"},
            json={"cart_id": cart["id"], "shipping_address": "Test address"},
        ).get_json()["data"]
        admin_token = self.make_admin("verified-review@example.com")
        status_update = self.client.patch(
            f"/api/v1/orders/{order['id']}/status",
            headers=self.auth_headers(admin_token),
            json={"status": "paid"},
        )
        self.assertEqual(status_update.status_code, 200)
        response = self.client.post(
            "/api/v1/social/reviews",
            headers=headers,
            json={
                "product_id": self.variant.product_id,
                "rating": 5,
                "title": "Excelente",
                "content": "Cumple lo prometido.",
            },
        )
        self.assertEqual(response.status_code, 201)
        body = response.get_json()["data"]
        self.assertEqual(body["title"], "Excelente")
        self.assertEqual(body["content"], "Cumple lo prometido.")
        self.assertTrue(body["is_verified_purchase"])

    def test_errors_have_consistent_json_and_request_id(self):
        response = self.client.get("/api/v1/resource-that-does-not-exist")
        self.assertEqual(response.status_code, 404)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "not_found")
        self.assertTrue(payload["error"]["request_id"])
        supplied_id = self.client.get(
            "/api/v1/resource-that-does-not-exist",
            headers={"X-Request-Id": "test-request-001"},
        )
        self.assertEqual(
            supplied_id.get_json()["error"]["request_id"], "test-request-001"
        )

    def test_invalid_payload_returns_validation_error(self):
        response = self.client.post(
            "/api/v1/auth/register",
            json={"email": "invalid", "password": "short", "unexpected": True},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"]["code"], "validation_error")

    def test_cors_only_allows_configured_origin(self):
        response = self.client.get(
            "/api/health", headers={"Origin": "http://localhost:5173"}
        )
        self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
        denied = self.client.get(
            "/api/health", headers={"Origin": "https://untrusted.example"}
        )
        self.assertIsNone(denied.headers.get("Access-Control-Allow-Origin"))

    def test_profile_update_and_password_change(self):
        data = self.register("profile@example.com")
        headers = self.auth_headers(data["access_token"])
        profile = self.client.patch(
            "/api/v1/auth/me",
            headers=headers,
            json={"first_name": "Updated"},
        )
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.get_json()["data"]["first_name"], "Updated")
        password = self.client.patch(
            "/api/v1/auth/me/password",
            headers=headers,
            json={"current_password": "password1", "new_password": "newpassword1"},
        )
        self.assertEqual(password.status_code, 204)
        login = self.client.post(
            "/api/v1/auth/login",
            json={"email": "profile@example.com", "password": "newpassword1"},
        )
        self.assertEqual(login.status_code, 200)

    def test_ai_interaction_returns_response(self):
        response = self.client.post(
            "/api/v1/ai/interactions",
            json={
                "use_case": "shopping_assistant",
                "prompt": "Recomiéndame algo para regalar",
            },
        )
        self.assertEqual(response.status_code, 201)
        data = response.get_json()["data"]
        self.assertIn("id", data)
        self.assertEqual(data["status"], "completed")
        self.assertIn("response", data)
        self.assertIsInstance(data["response"], str)
        self.assertTrue(len(data["response"]) > 0)
        self.assertIn("provider", data)
        self.assertIn("model", data)

    def test_ai_interaction_with_gemini_provider(self):
        from unittest.mock import MagicMock, patch

        mock_response = MagicMock()
        mock_response.text = "Te recomiendo el producto Test product por $10.00."

        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response

        with patch("google.generativeai.configure") as mock_configure, \
             patch("google.generativeai.GenerativeModel", return_value=mock_model_instance) as mock_gen_model:
            self.app.config["GEMINI_API_KEY"] = "fake-test-key"
            response = self.client.post(
                "/api/v1/ai/interactions",
                json={
                    "use_case": "shopping_assistant",
                    "prompt": "¿Qué me recomiendas?",
                },
            )
            self.assertEqual(response.status_code, 201)
            data = response.get_json()["data"]
            self.assertEqual(data["response"], "Te recomiendo el producto Test product por $10.00.")
            self.assertEqual(data["provider"], "google")
            self.assertEqual(data["model"], "gemini-3.6-flash")
            mock_configure.assert_called_once_with(api_key="fake-test-key")
            mock_model_instance.generate_content.assert_called_once()

    def test_ai_event_is_recorded(self):
        response = self.client.post(
            "/api/v1/ai/events",
            json={
                "event_type": "view_product",
                "metadata": {"source": "home_featured"},
                "session_key": "test-session-123",
            },
        )
        self.assertEqual(response.status_code, 201)
        data = response.get_json()["data"]
        self.assertIn("id", data)
        self.assertEqual(data["event_type"], "view_product")


if __name__ == "__main__":
    unittest.main()
