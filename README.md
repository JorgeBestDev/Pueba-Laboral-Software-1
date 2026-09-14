# Vokter — E-commerce Full Stack

Plataforma de comercio electrónico completa con backend Flask, frontend React y asistente de IA integrado. Incluye panel de administración, catálogo de productos con imágenes, carrito de compras, gestión de pedidos, reseñas y lista de deseos.

---

## Tabla de contenidos

1. [Stack tecnológico](#stack-tecnológico)
2. [Arquitectura de software](#arquitectura-de-software)
3. [Estructura de carpetas](#estructura-de-carpetas)
4. [Requisitos previos](#requisitos-previos)
5. [Instalación](#instalación)
6. [Variables de entorno](#variables-de-entorno)
7. [Levantar los servicios](#levantar-los-servicios)
8. [Panel de administración](#panel-de-administración)
9. [API REST](#api-rest)
10. [Despliegue en producción](#despliegue-en-producción)

---

## Stack tecnológico

### Backend

| Tecnología | Versión | Rol |
|---|---|---|
| **Python** | 3.11+ | Lenguaje principal |
| **Flask** | 3.1 | Framework web / API REST |
| **SQLAlchemy** (Flask-SQLAlchemy) | 3.1 | ORM |
| **Flask-Migrate** (Alembic) | 4.0 | Migraciones de base de datos |
| **Flask-Limiter** | 3.9 | Rate limiting |
| **Flask-CORS** | 5.0 | Control de orígenes cruzados |
| **PyJWT** | 2.10 | Autenticación con JWT |
| **Pillow** | 12.3 | Procesamiento de imágenes (cover-crop) |
| **google-generativeai** | 0.8 | Proveedor IA — Google Gemini |
| **groq** | 0.28 | Proveedor IA — Groq (Llama 3) |
| **Gunicorn** | 23.0 | Servidor WSGI para producción |
| **SQLite** / **PostgreSQL** | — | Base de datos (dev / prod) |

### Frontend

| Tecnología | Versión | Rol |
|---|---|---|
| **React** | 19 | Framework de UI |
| **TypeScript** | 6.0 | Tipado estático |
| **Vite** | 8 | Bundler y servidor de desarrollo |
| **Tailwind CSS** | 4 | Estilos utilitarios |
| **React Router** | 7 | Navegación SPA |

---

## Arquitectura de software

El proyecto adopta una **arquitectura en capas** con separación clara de responsabilidades, organizada por dominios de negocio.

```
┌─────────────────────────────────────────────────────┐
│                     Frontend (SPA)                   │
│         React 19 + TypeScript + Tailwind CSS         │
│   Storefront  │  Admin Panel  │  AI Chat Widget      │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP / JSON (REST)
                        ▼
┌─────────────────────────────────────────────────────┐
│                  API Layer (Flask)                   │
│              /api/v1  —  Blueprints                  │
│  auth  catalog  cart  orders  social  ai  admin      │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│               Service Layer                          │
│  CatalogService  OrderService  AIService  ...        │
│  Reglas de negocio, validaciones, transacciones      │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│               Data Layer (SQLAlchemy ORM)            │
│  Product  Order  Cart  User  Review  Wishlist  ...   │
└───────────────────────┬─────────────────────────────┘
                        │
              ┌─────────┴──────────┐
              ▼                    ▼
        SQLite (dev)         PostgreSQL (prod)
```

### Principios de diseño

- **Organización por dominio**: `identity`, `catalog`, `commerce`, `social`, `ai` — cada dominio tiene sus modelos, servicios y rutas cohesionados.
- **Rutas como adaptadores HTTP**: los endpoints solo validan la entrada HTTP, invocan un servicio y serializan la respuesta. No contienen lógica de negocio.
- **Servicios como núcleo de negocio**: validaciones, reglas de inventario, transacciones y lógica de dominio viven exclusivamente en `app/services/`.
- **Serialización centralizada**: `app/api/serializers.py` convierte modelos ORM a dicts JSON, evitando duplicación entre endpoints.
- **IA con fallback en cadena**: Gemini → Groq → motor de reglas local. Si un proveedor agota su cuota, el siguiente toma el relevo automáticamente.
- **Imágenes almacenadas localmente**: Pillow aplica cover-crop al subir (escala + recorte centrado) para que la imagen siempre encaje en el contenedor. Las URLs se guardan en base de datos y el backend las sirve en `/uploads/<filename>`.

---

## Estructura de carpetas

```
Entrevista Main/
│
├── app/                        # Aplicación Flask (backend)
│   ├── __init__.py             # App factory: crea Flask, registra extensiones y blueprints
│   ├── config.py               # Configuraciones por ambiente (dev / testing / prod)
│   ├── commands.py             # Comandos CLI personalizados (flask seed, etc.)
│   │
│   ├── api/                    # Capa HTTP — blueprints y serialización
│   │   ├── auth.py             # Decoradores de autenticación (@login_required, @admin_required)
│   │   ├── errors.py           # Manejadores globales de errores (404, 422, 500, etc.)
│   │   ├── serializers.py      # Funciones serialize_product / serialize_order / etc.
│   │   └── v1/                 # Endpoints versionados bajo /api/v1
│   │       ├── catalog.py      # GET /products, /categories, /filters (storefront público)
│   │       ├── cart.py         # CRUD carrito + merge + checkout
│   │       ├── orders.py       # Historial y detalle de pedidos del usuario
│   │       ├── identity.py     # Registro, login, refresh, logout, perfil
│   │       ├── users.py        # Direcciones del usuario autenticado
│   │       ├── social.py       # Reseñas de productos
│   │       ├── wishlist.py     # Lista de deseos
│   │       ├── ai.py           # POST /ai/interactions (chat IA) y /ai/events
│   │       ├── admin_auth.py   # Login del panel admin con captcha matemático
│   │       ├── admin_catalog.py# CRUD productos, variantes, categorías + subida de imágenes
│   │       ├── admin_orders.py # Gestión de pedidos (estados, pago, envío)
│   │       ├── admin_users.py  # Gestión de usuarios
│   │       └── admin_dashboard.py # Métricas y estadísticas del panel
│   │
│   ├── models/                 # Modelos SQLAlchemy — organizados por dominio
│   │   ├── common.py           # TimestampMixin (created_at / updated_at)
│   │   ├── __init__.py         # Re-exporta todos los modelos para Flask-Migrate
│   │   ├── identity/           # User, Address, AuthSession
│   │   ├── catalog/            # Category, Product, ProductImage, ProductVariant
│   │   ├── commerce/           # Cart, Order, OrderItem, OrderHistory, Payment, Shipment
│   │   ├── social/             # Review, Wishlist
│   │   └── ai/                 # UserEvent, AIInteraction
│   │
│   ├── services/               # Lógica de negocio — organizada por dominio
│   │   ├── catalog/
│   │   │   ├── catalog_service.py        # Listado, búsqueda y filtros del catálogo público
│   │   │   ├── admin_catalog_service.py  # CRUD admin de productos y categorías
│   │   │   └── image_upload_service.py   # Procesamiento (cover-crop Pillow) y persistencia de imágenes
│   │   ├── commerce/           # OrderService, CartService
│   │   ├── identity/           # AuthService, UserService
│   │   ├── social/             # ReviewService, WishlistService
│   │   ├── ai/
│   │   │   ├── ai_service.py         # Orquesta la cadena de proveedores IA
│   │   │   └── gemini_provider.py    # Gemini → Groq → RuleBasedFallback
│   │   └── exceptions.py       # ValidationError, ResourceNotFoundError, etc.
│   │
│   └── schemas/
│       └── validation.py       # Helpers de validación de payloads JSON
│
├── frontend/                   # Aplicación React (SPA)
│   ├── src/
│   │   ├── main.tsx            # Punto de entrada React + React Router
│   │   ├── App.tsx             # Rutas principales, layouts, contextos globales
│   │   ├── pages/              # Páginas del storefront público
│   │   │   ├── CatalogPage.tsx       # Catálogo con filtros, búsqueda y ordenamiento
│   │   │   ├── ProductDetailPage.tsx # Detalle de producto, galería, reseñas
│   │   │   ├── CheckoutPage.tsx      # Flujo de checkout
│   │   │   ├── OrdersPage.tsx        # Historial de pedidos del usuario
│   │   │   └── ...
│   │   ├── admin/              # Páginas del panel de administración
│   │   │   ├── AdminProductsPage.tsx # CRUD productos + variantes + subida de imágenes
│   │   │   ├── AdminOrdersPage.tsx   # Gestión de pedidos
│   │   │   ├── AdminUsersPage.tsx    # Gestión de clientes
│   │   │   └── AdminDashboardPage.tsx# Métricas
│   │   ├── components/         # Componentes reutilizables (UI)
│   │   │   ├── ui.tsx          # GlassButton, GlassInput, Modal, Stars, etc.
│   │   │   ├── AIWidget.tsx    # Chat flotante del asistente IA con Markdown renderer
│   │   │   ├── CartDrawer.tsx  # Drawer lateral del carrito
│   │   │   └── AuthModal.tsx   # Modal de login / registro
│   │   └── lib/                # Clientes HTTP y contextos React
│   │       ├── api.ts          # Cliente del storefront (tokens de usuario)
│   │       ├── admin-api.ts    # Cliente del admin (tokens separados, auto-refresh)
│   │       ├── auth-context.tsx
│   │       ├── cart-context.tsx
│   │       ├── wishlist-context.tsx
│   │       └── toast-context.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── migrations/                 # Migraciones Alembic (generadas automáticamente)
├── instance/                   # Datos locales: vokter.db (SQLite) + uploads/
├── tests/                      # Suite de pruebas unitarias e integración
├── run.py                      # Punto de entrada WSGI
├── requirements.txt            # Dependencias Python
├── render.yaml                 # Configuración de despliegue en Render.com
├── openapi.yaml                # Contrato OpenAPI de la API
└── .env.example                # Plantilla de variables de entorno
```

---

## Requisitos previos

- **Python 3.11+** — [python.org](https://www.python.org/downloads/)
- **Node.js 20+** — [nodejs.org](https://nodejs.org/)
- **npm 10+** (incluido con Node.js)
- (Opcional) **PostgreSQL 15+** para producción

---

## Instalación

### 1. Clonar el repositorio

```powershell
git clone <url-del-repositorio>
cd "Entrevista Main"
```

### 2. Configurar el backend

```powershell
# Crear entorno virtual
py -3 -m venv venv
.\venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt

# Copiar variables de entorno
Copy-Item .env.example .env
```

### 3. Configurar el frontend

```powershell
cd frontend
npm install
cd ..
```

---

## Variables de entorno

Edita el archivo `.env` en la raíz del proyecto:

```env
# ── Flask ──────────────────────────────────────────────
FLASK_APP=run.py
FLASK_DEBUG=1
SECRET_KEY=cambia-esto-en-produccion

# ── Base de datos ──────────────────────────────────────
# SQLite (desarrollo, por defecto):
DATABASE_URL=sqlite:///instance/vokter.db
# PostgreSQL (producción):
# DATABASE_URL=postgresql+psycopg://usuario:password@host:5432/vokter

# ── CORS ──────────────────────────────────────────────
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
CORS_SUPPORTS_CREDENTIALS=false

# ── IA — Google Gemini ────────────────────────────────
# Obtén tu clave en: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash

# ── IA — Groq (fallback cuando Gemini agota cuota) ────
# Obtén tu clave en: https://console.groq.com  (14 400 req/día gratis)
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant

# ── Imágenes ──────────────────────────────────────────
UPLOAD_FOLDER=instance/uploads
PRODUCT_IMAGE_WIDTH=800
PRODUCT_IMAGE_HEIGHT=800
MAX_CONTENT_LENGTH=8388608   # 8 MB
```

> Si ninguna clave de IA está configurada, el asistente responde igualmente usando un motor de reglas local que consulta el catálogo directamente en la base de datos.

El frontend tiene su propio archivo de entorno en `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

## Levantar los servicios

### Base de datos (primera vez)

```powershell
# Con el entorno virtual activado
$env:FLASK_APP = "run.py"

flask db upgrade        # aplica todas las migraciones
flask seed              # carga datos de prueba (categorías, productos, usuario admin)
```

### Backend (Flask)

```powershell
.\venv\Scripts\Activate.ps1
flask run --debug
```

El backend queda disponible en `http://localhost:5000`.

Endpoint de health check: `GET http://localhost:5000/api/v1/health`

### Frontend (React + Vite)

Abrir **una segunda terminal**:

```powershell
cd frontend
npm run dev
```

La aplicación web queda disponible en `http://localhost:5173`.

### Resumen de URLs en desarrollo

| Servicio | URL |
|---|---|
| Storefront (tienda) | http://localhost:5173 |
| Panel de administración | http://localhost:5173/admin |
| API REST | http://localhost:5000/api/v1 |
| Health check | http://localhost:5000/api/v1/health |
| Imágenes subidas | http://localhost:5000/uploads/\<filename\> |

---

## Panel de administración

El panel vive en `/admin` dentro del frontend. Requiere credenciales de usuario con rol `admin`.

**Credenciales por defecto** (creadas por `flask seed`):

| Campo | Valor |
|---|---|
| Email | `admin@vokter.com` |
| Contraseña | `admin123` |

El login incluye un **captcha matemático** anti-bot generado internamente (no requiere servicios externos).

### Funcionalidades del admin

- **Dashboard**: métricas de ventas, pedidos recientes, productos más vendidos.
- **Catálogo**: crear / editar / desactivar productos, variantes y categorías. Subida de imágenes con preview y cover-crop automático.
- **Pedidos**: ver y actualizar estados, datos de pago y envío.
- **Usuarios**: listar clientes, ver detalle de compras.

---

## API REST

Todos los endpoints se versionan bajo `/api/v1`. Las respuestas siguen el formato:

```json
// Éxito
{ "data": { ... } }

// Error
{ "error": { "code": "validation_error", "message": "...", "request_id": "..." } }
```

### Catálogo público

```
GET  /api/v1/catalog/products          # Lista paginada con filtros
GET  /api/v1/catalog/products/<id>     # Detalle por ID
GET  /api/v1/catalog/products/slug/<slug>  # Detalle por slug
GET  /api/v1/catalog/categories        # Lista de categorías activas
GET  /api/v1/catalog/filters           # Marcas y rango de precios disponibles
```

**Parámetros de `/catalog/products`:**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `q` | string | Búsqueda por nombre, descripción, marca o SKU |
| `category` | string | Slug de categoría |
| `brand` | string | Nombre de marca |
| `min_price` / `max_price` | float | Rango de precio |
| `available` | bool | Solo productos con stock |
| `featured` | bool | Solo productos destacados |
| `sort` | string | `newest` · `price_asc` · `price_desc` · `name` · `best_selling` · `top_rated` |
| `page` / `per_page` | int | Paginación |

### Autenticación

```
POST /api/v1/auth/register     # Crear cuenta
POST /api/v1/auth/login        # Login → {access_token, refresh_token}
GET  /api/v1/auth/me           # Perfil del usuario autenticado
POST /api/v1/auth/refresh      # Renovar access token
POST /api/v1/auth/logout       # Revocar sesión
```

### Carrito y pedidos

```
POST   /api/v1/carts                    # Crear carrito (anónimo o autenticado)
GET    /api/v1/carts/current            # Carrito activo del usuario
POST   /api/v1/carts/<id>/items         # Agregar ítem
PATCH  /api/v1/carts/<id>/items/<iid>   # Actualizar cantidad
DELETE /api/v1/carts/<id>/items/<iid>   # Eliminar ítem
DELETE /api/v1/carts/<id>/items         # Vaciar carrito
POST   /api/v1/carts/merge              # Fusionar carrito anónimo tras login
POST   /api/v1/orders/checkout          # Crear pedido desde carrito
GET    /api/v1/orders                   # Historial de pedidos
GET    /api/v1/orders/<id>              # Detalle de pedido
POST   /api/v1/orders/<id>/cancel       # Cancelar pedido
```

### Social

```
GET    /api/v1/social/products/<id>/reviews   # Reseñas de un producto
POST   /api/v1/social/reviews                 # Crear reseña
PATCH  /api/v1/social/reviews/<id>            # Editar reseña propia
DELETE /api/v1/social/reviews/<id>            # Eliminar reseña propia
GET    /api/v1/wishlist                       # Lista de deseos
POST   /api/v1/wishlist/items                 # Agregar producto
DELETE /api/v1/wishlist/items/<id>            # Quitar producto
```

### Asistente IA

```
POST /api/v1/ai/interactions    # Enviar mensaje al asistente
POST /api/v1/ai/events          # Registrar evento de comportamiento
```

El asistente usa la cadena de proveedores: **Gemini → Groq → motor de reglas local**. Si todos los proveedores externos fallan por cuota, el motor local responde directamente desde la base de datos (búsqueda de productos, información de envíos, pagos, devoluciones).

---

## Despliegue en producción

El proyecto incluye `render.yaml` preconfigurado para [Render.com](https://render.com).

### Variables requeridas en producción

| Variable | Descripción |
|---|---|
| `SECRET_KEY` | Clave secreta larga y aleatoria |
| `DATABASE_URL` | URL de PostgreSQL |
| `CORS_ORIGINS` | Dominio(s) del frontend en producción |
| `CORS_SUPPORTS_CREDENTIALS` | `true` |
| `GEMINI_API_KEY` | Clave de Google Gemini (opcional) |
| `GROQ_API_KEY` | Clave de Groq (opcional, fallback) |
| `VITE_API_URL` | URL pública del backend (para el frontend) |

### Comandos post-despliegue

```bash
flask db upgrade
flask seed
```

### Build de producción del frontend

```powershell
cd frontend
npm run build
# Los archivos estáticos quedan en frontend/dist/
```
