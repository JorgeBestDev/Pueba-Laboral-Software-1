# Vokter — E-commerce Full Stack

Plataforma de comercio electrónico completa con backend Flask, frontend React y asistente de IA integrado. Incluye panel de administración, catálogo de productos con imágenes, carrito de compras, gestión de pedidos, reseñas y lista de deseos.

## Demo y descarga

- **Aplicación web:** [vokter-web.onrender.com](https://vokter-web.onrender.com)
- **Health check de la API:** [vokter-api.onrender.com/api/v1/health](https://vokter-api.onrender.com/api/v1/health)
- **Descargar aplicación Android:** [vokter-mobile.apk](https://vokter-web.onrender.com/downloads/vokter-mobile.apk)
- **Proyecto Android en Expo:** [ver proyecto EAS](https://expo.dev/accounts/jorgebestdev/projects/vokter-mobile)

La aplicación móvil está disponible actualmente solo para Android. Desde el
navbar de la aplicación web se puede abrir un modal con descripción, código QR
y enlace alternativo de descarga.

### Credenciales de demostración

Después de ejecutar `flask seed`, están disponibles estas cuentas:

- **Cliente:** `demo@vokter.local` / `demo-password`
- **Administrador:** `admin@vokter.com` / `admin-password`

Estas credenciales son únicamente para la evaluación local/demo y deben
reemplazarse en cualquier entorno real.

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
10. [Aplicación móvil Android](#aplicación-móvil-android)
11. [Evidencias visuales](#evidencias-visuales)
12. [Pruebas y calidad](#pruebas-y-calidad)
13. [Despliegue en producción](#despliegue-en-producción)

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
| **google-genai** | 1.68 | Proveedor IA — Google Gemini (SDK oficial actual) |
| **groq** | 0.28 | Proveedor IA — Groq (`openai/gpt-oss-20b`) |
| **cloudinary** | 1.44 | Almacenamiento persistente de imágenes |
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

### Aplicación móvil

| Tecnología | Versión | Rol |
|---|---|---|
| **Expo** | 57 | Toolchain y distribución Android |
| **React Native** | 0.86 | Interfaz móvil nativa |
| **Expo Router** | 57 | Navegación basada en archivos |
| **EAS Build** | — | Generación del APK Android |

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
- **IA con fallback en cadena**: Groq → Gemini → motor de reglas local. Si un proveedor falla, el siguiente toma el relevo automáticamente.
- **Imágenes persistentes**: Pillow aplica cover-crop al subir y Cloudinary almacena las imágenes en producción. En desarrollo, si Cloudinary no está configurado, se utiliza `instance/uploads/` como fallback local.

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
│   │   │   └── image_upload_service.py   # Procesamiento y almacenamiento Cloudinary/local
│   │   ├── commerce/           # OrderService, CartService
│   │   ├── identity/           # AuthService, UserService
│   │   ├── social/             # ReviewService, WishlistService
│   │   ├── ai/
│   │   │   ├── ai_service.py         # Orquesta la cadena de proveedores IA
│   │   │   └── gemini_provider.py    # Groq → Gemini → RuleBasedFallback
│   │   └── exceptions.py       # ValidationError, ResourceNotFoundError, etc.
│   │
│   └── schemas/
│       └── validation.py       # Helpers de validación de payloads JSON
│
├── frontend/                   # Aplicación React (SPA)
│   ├── public/downloads/       # APK Android descargable desde el storefront
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
├── mobile/                     # Aplicación Expo/React Native para Android
│   ├── app/                    # Rutas de la aplicación móvil
│   ├── src/                    # Cliente API, contextos y componentes
│   ├── app.json                # Configuración Expo
│   └── eas.json                # Perfil EAS para generar APK
├── instance/                   # Datos locales: vokter.db (SQLite) + uploads/ (fallback)
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

# ── Recuperación de contraseña — SMTP ─────────────────
# PASSWORD_RESET_URL debe apuntar a la pantalla web que consume el token.
PASSWORD_RESET_URL=http://localhost:5173/reset-password
PASSWORD_RESET_TTL_SECONDS=1800
PASSWORD_RESET_RATE_LIMIT=5 per hour
MAIL_SERVER=smtp.example.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USE_SSL=false
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_DEFAULT_SENDER=no-reply@example.com

# ── IA — Google Gemini ────────────────────────────────
# Obtén tu clave en: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
AI_PROVIDER_TIMEOUT_SECONDS=10
AI_MAX_OUTPUT_TOKENS=256

# ── IA — Groq (proveedor principal de baja latencia) ──
# Obtén tu clave en: https://console.groq.com  (14 400 req/día gratis)
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

# ── Imágenes ──────────────────────────────────────────
UPLOAD_FOLDER=instance/uploads
PRODUCT_IMAGE_WIDTH=800
PRODUCT_IMAGE_HEIGHT=800
MAX_CONTENT_LENGTH=8388608   # 8 MB

# Cloudinary — requerido en producción para que las imágenes sobrevivan a los
# reinicios y despliegues de Render. Usa CLOUDINARY_URL o las tres credenciales.
CLOUDINARY_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=vokter/products
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
flask seed              # carga datos de prueba y garantiza mínimo 5 unidades por variante
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

### Aplicación móvil Android

La aplicación móvil se desarrolla con Expo y actualmente está disponible
únicamente para Android. El APK generado se encuentra en:

```text
frontend/public/downloads/vokter-mobile.apk
```

Al ejecutar el frontend web, el enlace público de descarga es:

```text
/downloads/vokter-mobile.apk
```

Para generar una nueva versión con EAS:

```powershell
cd mobile
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build:download --build-id <id-del-build>
```

El perfil `preview` está configurado en `mobile/eas.json` para producir un
APK instalable mediante distribución interna.

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
| Contraseña | `admin-password` |

El login incluye un **captcha matemático** anti-bot generado internamente (no requiere servicios externos).

### Funcionalidades del admin

- **Dashboard**: métricas de ventas, pedidos recientes, productos más vendidos.
- **Catálogo**: crear / editar / desactivar productos, variantes y categorías. Subida de imágenes con preview y cover-crop automático.
- **Pedidos**: ver y actualizar estados, datos de pago y envío.
- **Usuarios**: listar clientes, ver detalle de compras.

### Funcionalidades diferenciadoras

- Catálogo con búsqueda, filtros, orden por novedades y más vendidos, stock y
  navegación por categorías.
- Carrito con actualización optimista, selección de variantes y persistencia
  de sesión anónima.
- Lista de deseos sincronizada entre la aplicación web y Android.
- Recuperación de contraseña mediante correo, token de un solo uso, expiración
  y almacenamiento seguro del hash.
- Asistente IA con cadena de proveedores **Groq → Gemini → fallback local** y
  enlaces internos a productos.
- Imágenes procesadas con Pillow y almacenadas persistentemente en Cloudinary
  en producción.
- Aplicación móvil Android descargable desde la aplicación web mediante APK y
  código QR.

---

## Evidencias visuales

Las siguientes evidencias muestran los flujos principales de la solución web,
el panel administrativo y la aplicación móvil Android. Los archivos originales
se encuentran en [`docs/screenshots/`](<C:/Users/Jorge/Documents/Programacion/Entrevista Main/docs/screenshots/>).

### Aplicación web

#### Inicio, catálogo y producto

<p align="center">
  <img src="docs/screenshots/landing.PNG" alt="Página de inicio de Vokter" width="49%">
  <img src="docs/screenshots/products.PNG" alt="Catálogo de productos" width="49%">
</p>

<p align="center">
  <img src="docs/screenshots/product_detail.PNG" alt="Detalle de producto" width="49%">
  <img src="docs/screenshots/features.PNG" alt="Productos destacados y funcionalidades" width="49%">
</p>

#### Carrito, checkout y pedidos

<p align="center">
  <img src="docs/screenshots/cart.PNG" alt="Carrito de compras con variantes e imágenes" width="32%">
  <img src="docs/screenshots/checkout.PNG" alt="Resumen de checkout" width="32%">
  <img src="docs/screenshots/payment_method_checkout.PNG" alt="Método de pago en checkout" width="32%">
</p>

<p align="center">
  <img src="docs/screenshots/addresses_checkout.PNG" alt="Dirección durante el checkout" width="49%">
  <img src="docs/screenshots/active_orders.PNG" alt="Pedidos activos del usuario" width="49%">
</p>

<details>
<summary>Ver seguimiento, cancelación y confirmación de pedidos</summary>

<p align="center">
  <img src="docs/screenshots/user_orders.PNG" alt="Historial de pedidos" width="32%">
  <img src="docs/screenshots/user_order_placed.PNG" alt="Pedido creado" width="32%">
  <img src="docs/screenshots/user_order_status.PNG" alt="Estado de pedido" width="32%">
</p>

<p align="center">
  <img src="docs/screenshots/user_order_cancelled.PNG" alt="Pedido cancelado" width="49%">
</p>
</details>

#### Cuenta, direcciones y lista de deseos

<p align="center">
  <img src="docs/screenshots/user_account.PNG" alt="Cuenta del usuario" width="32%">
  <img src="docs/screenshots/user_addresses.PNG" alt="Direcciones guardadas" width="32%">
  <img src="docs/screenshots/user_wishlist.PNG" alt="Lista de deseos con imágenes" width="32%">
</p>

<p align="center">
  <img src="docs/screenshots/user_reset_password.PNG" alt="Recuperación de contraseña" width="49%">
</p>

#### Asistente IA y descarga móvil

<p align="center">
  <img src="docs/screenshots/IA_assistant.PNG" alt="Asistente IA de Vokter" width="49%">
  <img src="docs/screenshots/app_download.PNG" alt="Modal de descarga del APK con código QR" width="49%">
</p>

### Panel administrativo

<p align="center">
  <img src="docs/screenshots/admin_login.PNG" alt="Inicio de sesión administrativo" width="32%">
  <img src="docs/screenshots/admin_dashboard.PNG" alt="Dashboard administrativo" width="66%">
</p>

<p align="center">
  <img src="docs/screenshots/admin_products.PNG" alt="Gestión administrativa de productos" width="49%">
  <img src="docs/screenshots/edit_products.PNG" alt="Edición de productos" width="49%">
</p>

<p align="center">
  <img src="docs/screenshots/admin_categories.PNG" alt="Gestión de categorías" width="32%">
  <img src="docs/screenshots/admin_customers.PNG" alt="Gestión de clientes" width="32%">
  <img src="docs/screenshots/admin_user_history.PNG" alt="Historial de usuario" width="32%">
</p>

<p align="center">
  <img src="docs/screenshots/admin_order_status.PNG" alt="Actualización del estado de pedidos" width="49%">
</p>

### Aplicación móvil Android

<p align="center">
  <img src="docs/screenshots/mobile_landing.PNG" alt="Catálogo móvil" width="32%">
  <img src="docs/screenshots/mobile_producto_details.PNG" alt="Detalle de producto móvil" width="32%">
  <img src="docs/screenshots/mobile_cart.PNG" alt="Carrito móvil" width="32%">
</p>

<p align="center">
  <img src="docs/screenshots/mobile_addresses_checkout.PNG" alt="Direcciones y checkout móvil" width="32%">
  <img src="docs/screenshots/mobile_user_info.PNG" alt="Perfil móvil" width="32%">
  <img src="docs/screenshots/mobile_wishlist.PNG" alt="Lista de deseos móvil" width="32%">
</p>

<p align="center">
  <img src="docs/screenshots/mobile_IA_assistant.PNG" alt="Asistente IA móvil" width="32%">
</p>

Los GIF no son obligatorios. Las capturas PNG son suficientes para revisar la
propuesta y permiten identificar cada funcionalidad de forma independiente.
No se incluyen claves API, tokens ni contraseñas en las evidencias.

---

## Pruebas y calidad

Backend:

```powershell
.\venv\Scripts\python.exe -m unittest tests.test_api
```

Frontend web:

```powershell
cd frontend
npm run build
npm run lint
```

Aplicación móvil:

```powershell
cd mobile
npm run typecheck
```

La suite backend cubre autenticación, catálogo, carrito, checkout, wishlist,
direcciones, recuperación de contraseña, IA y administración.

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

### Recuperación de contraseña

El flujo utiliza tokens aleatorios de un solo uso. La API almacena únicamente el
hash SHA-256 del token, aplica una expiración configurable y revoca las sesiones
activas cuando la contraseña se cambia.

```text
POST /api/v1/auth/password-reset/request   # { "email": "cliente@ejemplo.com" }
POST /api/v1/auth/password-reset/confirm   # { "token": "...", "new_password": "..." }
```

La solicitud siempre responde con el mismo mensaje, exista o no la cuenta, para
evitar enumerar correos registrados. En producción se deben configurar las
variables SMTP y ejecutar `flask db upgrade` para crear `password_reset_tokens`.

El asistente usa la cadena de proveedores: **Groq → Gemini → motor de reglas local**. Si todos los proveedores externos fallan por timeout, modelo no disponible, cuota o cualquier otro error, el motor local responde directamente desde la base de datos (búsqueda de productos, información de envíos, pagos, devoluciones).

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
| `PASSWORD_RESET_URL` | URL pública de la pantalla de nueva contraseña |
| `PASSWORD_RESET_TTL_SECONDS` | Vigencia del token (por defecto 1800 segundos) |
| `MAIL_SERVER` / `MAIL_PORT` | Servidor y puerto SMTP |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Credenciales SMTP |
| `MAIL_USE_TLS` / `MAIL_USE_SSL` | Seguridad de la conexión SMTP |
| `MAIL_DEFAULT_SENDER` | Remitente de recuperación |
| `CLOUDINARY_URL` | URL de conexión de Cloudinary (recomendado) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Credenciales alternativas de Cloudinary |
| `CLOUDINARY_FOLDER` | Carpeta de assets, por defecto `vokter/products` |
| `GEMINI_API_KEY` | Clave de Google Gemini (opcional) |
| `GEMINI_MODEL` | Modelo Gemini habilitado para la cuenta |
| `AI_PROVIDER_TIMEOUT_SECONDS` | Tiempo máximo de espera por proveedor externo |
| `AI_MAX_OUTPUT_TOKENS` | Límite de tokens de respuesta para mantener respuestas ágiles |
| `GROQ_API_KEY` | Clave de Groq (opcional, fallback) |
| `VITE_API_URL` | URL pública del backend (para el frontend) |

### Comandos post-despliegue

```bash
flask db upgrade
flask seed
```

### Configurar Cloudinary

1. Crea una cuenta en [Cloudinary](https://cloudinary.com/).
2. En Render agrega `CLOUDINARY_URL` con la URL de conexión del panel de
   Cloudinary. No la incluyas en Git ni en el frontend.
3. Ejecuta `flask db upgrade` para agregar el identificador de asset de
   Cloudinary a `product_images`.
4. Sube nuevamente las imágenes del catálogo desde el panel administrativo.

Las nuevas imágenes se procesan como JPEG, se suben a Cloudinary y guardan su
`secure_url` directamente en la base de datos. Las imágenes antiguas que solo
apuntan a `/uploads/...` deben volver a subirse porque sus archivos locales no
se conservan en Render.

### Build de producción del frontend

```powershell
cd frontend
npm run build
# Los archivos estáticos quedan en frontend/dist/
```
