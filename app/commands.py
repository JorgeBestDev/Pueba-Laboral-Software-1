"""Flask CLI commands.

``flask seed``  — populates the database with the full demo catalog
                  (categories, products, variants, images) plus the two
                  standard demo user accounts.  The command is idempotent:
                  running it multiple times is safe; existing records are
                  skipped rather than duplicated. Demo inventory is restored
                  to at least five units when it is depleted.
"""
from decimal import Decimal

import click

from app import db
from app.models import Category, Product, ProductVariant, User, UserRole
from app.models.catalog.product_image import ProductImage

DEMO_STOCK_FLOOR = 5

# ---------------------------------------------------------------------------
# Catalog data — mirrors the current production database
# ---------------------------------------------------------------------------

CATEGORIES = [
    {"name": "Audio",                      "slug": "audio"},
    {"name": "Bluetooth",                  "slug": "bluetooth"},
    {"name": "Cable y Cargadores",         "slug": "cable-y-cargadores"},
    {"name": "Power Banks",                "slug": "power-banks"},
    {"name": "Accesorios",                 "slug": "accesorios"},
    {"name": "Footwear",                   "slug": "footwear"},
    {"name": "Ropa",                       "slug": "ropa"},
    {"name": "Hogar",                      "slug": "hogar"},
    {"name": "Consolas y Entretenimiento", "slug": "consolas-y-entretenimiento"},
]

# Each product entry:
#   slug, name, brand, base_price, is_featured, is_active,
#   categories: [slug, ...]
#   variants:   [{ sku, name, price, stock_quantity }]
#   images:     ["/uploads/<filename>"]   — files must exist in instance/uploads/
PRODUCTS = [
    # ── Audio ────────────────────────────────────────────────────────────────
    {
        "slug": "Audifonos-apple",
        "name": "Audifonos Apple",
        "brand": "Apple",
        "base_price": "5000.00",
        "is_featured": False,
        "categories": ["audio"],
        "variants": [
            {"sku": "Audifonos-Apple-B", "name": "Blancos", "price": "3800.00", "stock_quantity": 50},
            {"sku": "Audifonos-Apple-R", "name": "Rojos",   "price": "3800.00", "stock_quantity": 10},
            {"sku": "Audifonos-Apple-G", "name": "Gris",    "price": "3500.00", "stock_quantity": 15},
        ],
        "images": [
            "/uploads/532b15321fc8470c8a8df40d3cac03b9.jpg",
            "/uploads/252d3e22e0d84d5ea374dacd81c68f6e.jpg",
            "/uploads/bc132f2ae1524e668986f07d500ccff2.jpg",
        ],
    },
    {
        "slug": "Diademas-Apple",
        "name": "Diademas Apple",
        "brand": "Apple",
        "base_price": "25000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [
            {"sku": "Diadema-Apple-Max", "name": "Air Max", "price": "90000.00", "stock_quantity": 15},
            {"sku": "Diadema-Apple-B",   "name": "Blanca",  "price": "52000.00", "stock_quantity": 50},
            {"sku": "Diadema-Apple-G",   "name": "Gris",    "price": "52000.00", "stock_quantity": 23},
        ],
        "images": [
            "/uploads/39872ed259cb4e5fa51b0c6427c16d30.jpg",
            "/uploads/a06912c3bcfc4d18bfd55761f9434227.jpg",
            "/uploads/d3bb657c272b438fb6c1714efb287ae8.jpg",
        ],
    },
    {
        "slug": "Balaca-Gamer-VokTer",
        "name": "Balaca Gamer",
        "brand": "VokTer",
        "base_price": "63000.00",
        "is_featured": False,
        "categories": ["audio", "consolas-y-entretenimiento"],
        "variants": [],
        "images": ["/uploads/514560f16ff94a9baa7aa30c072206fa.jpg"],
    },
    {
        "slug": "Diadema-Sony-MDR-XB-450",
        "name": "Diadema Sony MDR XB-450",
        "brand": "Sony",
        "base_price": "14500.00",
        "is_featured": False,
        "categories": ["audio"],
        "variants": [
            {"sku": "Diadema-Sony-MDR-XB-450-N", "name": "Negro", "price": "14500.00", "stock_quantity": 25},
        ],
        "images": ["/uploads/077b389213464e44abc9df373a063bf4.jpg"],
    },
    {
        "slug": "Manos-Libres-Samsung",
        "name": "Manos Libres Samsung",
        "brand": "Samsung",
        "base_price": "3600.00",
        "is_featured": False,
        "categories": ["audio"],
        "variants": [],
        "images": ["/uploads/2fc25717c13548fda19fdd8b545655c2.jpg"],
    },
    {
        "slug": "Balaca-Samsung-Pro-Air",
        "name": "Balaca Samsung Pro Air",
        "brand": "Samsung",
        "base_price": "35000.00",
        "is_featured": False,
        "categories": ["audio"],
        "variants": [],
        "images": ["/uploads/569fcc7c29d44976b5ab50994046dee8.jpg"],
    },
    {
        "slug": "Diadema-Sony-N65BT",
        "name": "Diadema Sony N65BT",
        "brand": "Sony",
        "base_price": "32000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [],
        "images": ["/uploads/5aba5b73c96d4a75803121cd882e5be3.jpg"],
    },
    {
        "slug": "Diadema-Sony-450BT",
        "name": "Diadema Sony 450BT",
        "brand": "Sony",
        "base_price": "25000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [],
        "images": ["/uploads/8c444337fdf64061bfeaa9b1baf66e68.jpg"],
    },
    {
        "slug": "Conduccion-Osea-F20-VokTer",
        "name": "Conduccion Osea F20",
        "brand": "VokTer",
        "base_price": "34000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [],
        "images": ["/uploads/46fd084f191f406693089d42c1fe779b.jpg"],
    },
    {
        "slug": "Cuellera-Bluetooth-ZON-35-VokTer",
        "name": "Cuellera Bluetooth ZON-35",
        "brand": "VokTer",
        "base_price": "18000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [],
        "images": ["/uploads/010daac60418409cb986b69cab0696ad.jpg"],
    },
    # ── Parlantes ────────────────────────────────────────────────────────────
    {
        "slug": "Parlante-S410-VokTer",
        "name": "Parlante S410",
        "brand": "VokTer",
        "base_price": "38000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [],
        "images": ["/uploads/d63a4c39bef6455285c4d90e4de1abbd.jpg"],
    },
    {
        "slug": "Parlante-S430-VokTer",
        "name": "Parlante S430",
        "brand": "VokTer",
        "base_price": "75000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [],
        "images": ["/uploads/bd120b85c9b94ea39301d172f6c0451d.jpg"],
    },
    {
        "slug": "Parlante-FL828-VokTer",
        "name": "Parlante FL828",
        "brand": "VokTer",
        "base_price": "45000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [],
        "images": ["/uploads/b6498b481fc247f58399aa7a6aa33b15.jpg"],
    },
    {
        "slug": "Parlante-S640-VokTer",
        "name": "Parlante S640",
        "brand": "VokTer",
        "base_price": "13000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [],
        "images": ["/uploads/8aafe61875854083b782a83d5495b469.jpg"],
    },
    {
        "slug": "Parlante-S520-VokTer",
        "name": "Parlante S520",
        "brand": "VokTer",
        "base_price": "45000.00",
        "is_featured": False,
        "categories": ["audio", "bluetooth"],
        "variants": [],
        "images": ["/uploads/83b227ef6fa84ef5a45405ae85a5e3c6.jpg"],
    },
    # ── Cables y Cargadores ──────────────────────────────────────────────────
    {
        "slug": "Cable-Tipo-C-VokTer",
        "name": "Cable Tipo C",
        "brand": "VokTer",
        "base_price": "6500.00",
        "is_featured": False,
        "categories": ["cable-y-cargadores"],
        "variants": [
            {"sku": "Cable-Tipo-C-120W-VokTer", "name": "120W",   "price": "6500.00",  "stock_quantity": 12},
            {"sku": "Cable-2-en-1-VokTer",       "name": "2 en 1", "price": "13800.00", "stock_quantity": 5},
        ],
        "images": ["/uploads/30464b5915aa4829a42c28aee2035988.jpg"],
    },
    {
        "slug": "Cable-de-Carga-Xiaomi",
        "name": "Cable de Carga Xiaomi",
        "brand": "Xiaomi",
        "base_price": "3000.00",
        "is_featured": False,
        "categories": ["cable-y-cargadores"],
        "variants": [
            {"sku": "Cable-Xiaomi-Tipo-B", "name": "Tipo B", "price": "3000.00", "stock_quantity": 20},
            {"sku": "Cable-Xiaomi-Tipo-C", "name": "Tipo C", "price": "3500.00", "stock_quantity": 100},
        ],
        "images": ["/uploads/eeb0e2ae6ed94a2cbda18e9cc5caaac0.jpg"],
    },
    {
        "slug": "Cable-RCA-2x1",
        "name": "Cable RCA 2x1",
        "brand": "VokTer",
        "base_price": "4500.00",
        "is_featured": False,
        "categories": ["cable-y-cargadores"],
        "variants": [],
        "images": ["/uploads/a85568fcce9e4b24b9b1e6f8c022d368.jpg"],
    },
    # ── Accesorios ───────────────────────────────────────────────────────────
    {
        "slug": "Holder-para-Carro-VokTer",
        "name": "Holder para Carro",
        "brand": "VokTer",
        "base_price": "10000.00",
        "is_featured": False,
        "categories": ["accesorios"],
        "variants": [],
        "images": ["/uploads/b700a134e5cd4e328853adb3453a53d2.jpg"],
    },
    # ── Power Banks ──────────────────────────────────────────────────────────
    {
        "slug": "PowerBank-20000MAH-VokTer",
        "name": "PowerBank 20,000 MAH",
        "brand": "VokTer",
        "base_price": "55000.00",
        "is_featured": False,
        "categories": ["power-banks"],
        "variants": [],
        "images": ["/uploads/4a7fed2844ab40ce8394f115dd5b08d3.jpg"],
    },
    # ── Consolas y Entretenimiento ───────────────────────────────────────────
    {
        "slug": "Combo-Gamer-T25-VokTer",
        "name": "Combo Gamer T25",
        "brand": "VokTer",
        "base_price": "45000.00",
        "is_featured": False,
        "categories": ["consolas-y-entretenimiento"],
        "variants": [],
        "images": ["/uploads/2834f34403e745fdbc672cf2dc623672.jpg"],
    },
    {
        "slug": "Consola-Verde-Retro-VokTer",
        "name": "Consola Verde Retro",
        "brand": "VokTer",
        "base_price": "75000.00",
        "is_featured": False,
        "categories": ["consolas-y-entretenimiento"],
        "variants": [],
        "images": ["/uploads/c2a58279f5fc48de800fe0b3f82ab377.jpg"],
    },
    # ── Ropa ─────────────────────────────────────────────────────────────────
    {
        "slug": "Sudaderas-Puma",
        "name": "Sudaderas Puma",
        "brand": "Puma",
        "base_price": "145000.00",
        "is_featured": False,
        "categories": ["ropa"],
        "variants": [
            {"sku": "Sudadera-Puma-N", "name": "Negra", "price": "140000.00", "stock_quantity": 15},
            {"sku": "Sudadera-Puma-A", "name": "Azul",  "price": "145000.00", "stock_quantity": 22},
        ],
        "images": ["/uploads/bfbf3f2787124f12bc97adfb5415b322.jpg"],
    },
    # ── Hogar ─────────────────────────────────────────────────────────────────
    {
        "slug": "Sabanas-Cama-Star",
        "name": "Sabanas Cama",
        "brand": "Star",
        "base_price": "15000.00",
        "is_featured": False,
        "categories": ["hogar"],
        "variants": [],
        "images": ["/uploads/ad14e5bb3c8c4b0bbe93ce8c89929b42.jpg"],
    },
    # ── Footwear ─────────────────────────────────────────────────────────────
    {
        "slug": "Nike-SB-Negras",
        "name": "Nike SB",
        "brand": "Nike",
        "base_price": "180000.00",
        "is_featured": False,
        "categories": ["footwear"],
        "variants": [],
        "images": ["/uploads/daa17b7dc7db4552901951ec04b685e3.jpg"],
    },
]

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

USERS = [
    {
        "email": "demo@vokter.local",
        "first_name": "Demo",
        "last_name": "User",
        "password": "demo-password",
        "role": UserRole.CUSTOMER,
    },
    {
        "email": "admin@vokter.com",
        "first_name": "Admin",
        "last_name": "Vokter",
        "password": "admin-password",
        "role": UserRole.ADMIN,
    },
]


# ---------------------------------------------------------------------------
# CLI command
# ---------------------------------------------------------------------------

def register_commands(app):
    @app.cli.command("seed")
    def seed():
        """Populate the database with the full demo catalog + demo accounts.

        Idempotent: records that already exist (matched by slug / email / sku)
        are preserved, while depleted demo inventory is replenished to five
        units so the command can be run multiple times safely.
        """
        # ── Categories ───────────────────────────────────────────────────────
        cat_map: dict[str, Category] = {}
        for cat_data in CATEGORIES:
            cat = db.session.scalar(
                db.select(Category).where(Category.slug == cat_data["slug"])
            )
            if cat is None:
                cat = Category(
                    name=cat_data["name"],
                    slug=cat_data["slug"],
                    is_active=True,
                )
                db.session.add(cat)
                click.echo(f"  + Category: {cat_data['name']}")
            else:
                # Ensure the category is active even if it was soft-deleted
                cat.is_active = True
            cat_map[cat_data["slug"]] = cat

        db.session.flush()  # get IDs before creating products

        # ── Products, variants & images ──────────────────────────────────────
        for prod_data in PRODUCTS:
            existing = db.session.scalar(
                db.select(Product).where(Product.slug == prod_data["slug"])
            )
            if existing is not None:
                # Product exists — keep it active and replenish demo inventory.
                existing.is_active = True
                _sync_variants(existing, prod_data)
                _sync_images(existing, prod_data["images"])
                continue

            product = Product(
                name=prod_data["name"],
                slug=prod_data["slug"],
                brand=prod_data.get("brand"),
                base_price=Decimal(prod_data["base_price"]),
                is_featured=prod_data.get("is_featured", False),
                is_active=True,
            )

            # Attach categories
            for cat_slug in prod_data.get("categories", []):
                if cat_slug in cat_map:
                    product.categories.append(cat_map[cat_slug])

            # Attach variants. Products without explicit variants receive a
            # single demo variant so they can also be added to the cart.
            _sync_variants(product, prod_data)

            db.session.add(product)
            db.session.flush()  # get product.id before adding images

            # Attach images
            _sync_images(product, prod_data.get("images", []))

            click.echo(
                f"  + Product: {prod_data['name']}"
                f" ({len(product.variants)} variants,"
                f" {len(prod_data.get('images', []))} images)"
            )

        # ── Users ────────────────────────────────────────────────────────────
        for user_data in USERS:
            user = db.session.scalar(
                db.select(User).where(User.email == user_data["email"])
            )
            if user is None:
                user = User(
                    email=user_data["email"],
                    first_name=user_data["first_name"],
                    last_name=user_data["last_name"],
                    role=user_data["role"],
                )
                user.set_password(user_data["password"])
                db.session.add(user)
                click.echo(f"  + User: {user_data['email']} ({user_data['role'].value})")

        db.session.commit()
        click.echo("\nSeed completed successfully.")


def _sync_images(product: Product, image_urls: list[str]) -> None:
    """Add any missing images to a product (by URL); never duplicates."""
    existing_urls = {img.url for img in product.images}
    for order, url in enumerate(image_urls):
        if url not in existing_urls:
            product.images.append(
                ProductImage(
                    url=url,
                    alt_text=product.name,
                    sort_order=order,
                )
            )


def _sync_variants(product: Product, product_data: dict) -> None:
    """Ensure every demo product has purchasable inventory.

    Existing inventory is preserved unless it falls below the demo floor.
    This makes repeated ``flask seed`` runs useful after test purchases
    without overwriting larger quantities or catalog changes made by an
    administrator.
    """
    variant_data = product_data.get("variants") or [
        {
            "sku": f"{product_data['slug']}-default",
            "name": "Única",
            "price": product_data["base_price"],
            "stock_quantity": DEMO_STOCK_FLOOR,
        }
    ]
    product_variants = {variant.sku: variant for variant in product.variants}

    for var_data in variant_data:
        variant = product_variants.get(var_data["sku"])
        if variant is None:
            variant = db.session.scalar(
                db.select(ProductVariant).where(
                    ProductVariant.sku == var_data["sku"]
                )
            )

        if variant is None:
            product.variants.append(
                ProductVariant(
                    sku=var_data["sku"],
                    name=var_data["name"],
                    price=Decimal(var_data["price"]),
                    stock_quantity=max(
                        int(var_data.get("stock_quantity", DEMO_STOCK_FLOOR)),
                        DEMO_STOCK_FLOOR,
                    ),
                    is_active=True,
                )
            )
            continue

        if variant.product_id is not None and variant.product_id != product.id:
            raise click.ClickException(
                f"SKU '{var_data['sku']}' already belongs to another product."
            )

        if variant.stock_quantity < DEMO_STOCK_FLOOR:
            variant.stock_quantity = DEMO_STOCK_FLOOR
