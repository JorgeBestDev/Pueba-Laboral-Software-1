import os

import psycopg
import requests

DATABASE_URL = os.environ["DATABASE_URL"]
API = "http://127.0.0.1:5000/api/v1"

conn = psycopg.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()
cur.execute("UPDATE users SET role = 'ADMIN' WHERE email = %s", ("jorge.tester@example.com",))
print("rows updated:", cur.rowcount)

login = requests.post(f"{API}/auth/login", json={"email": "jorge.tester@example.com", "password": "password123"})
token = login.json()["data"]["access_token"]

update = requests.patch(
    f"{API}/orders/1/status",
    headers={"Authorization": f"Bearer {token}"},
    json={"status": "paid"},
)
print("status update:", update.status_code, update.json())

# revert role back to customer so the demo account behaves like a normal shopper again
cur.execute("UPDATE users SET role = 'CUSTOMER' WHERE email = %s", ("jorge.tester@example.com",))
print("role reverted:", cur.rowcount)
