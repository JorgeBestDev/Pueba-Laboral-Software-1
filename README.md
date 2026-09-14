# Vokter API

API base para una propuesta de comercio electrónico inspirada en el ejercicio
VOKTER. El backend está preparado para alimentar una aplicación React + Tailwind
y compartir dominio con una futura aplicación móvil.

## Alcance del modelo

- **Identidad:** usuarios, roles, contraseñas con hash y direcciones.
- **Catálogo:** categorías, productos, imágenes y variantes con SKU, precio e inventario.
- **Comercio:** carrito para usuarios o sesiones anónimas, pedidos y sus líneas.
- **Comunidad:** reseñas verificables y lista de favoritos.
- **Evolución/IA:** eventos de comportamiento e interacciones con proveedores de IA
  desacopladas del modelo de negocio para recomendaciones, búsqueda semántica o
  asistente de compra.

La web puede incluir una sección de descarga de la aplicación móvil (APK,
TestFlight o enlace a la tienda). La URL de distribución debe vivir en la
configuración del frontend y no se almacena como una entidad de negocio en esta
API.

## Organización por dominios

Los modelos se agrupan por contexto de negocio para mantener alta cohesión y
bajo acoplamiento:

```text
app/
├── api/
├── config.py
├── services/
│   ├── catalog/
│   ├── commerce/
│   │   └── order_service.py
│   ├── identity/
│   ├── social/
│   └── ai/
└── models/
    ├── common.py
    ├── identity/
    │   ├── user.py
    │   └── address.py
    ├── catalog/
    │   ├── category.py
    │   ├── product.py
    │   ├── product_image.py
    │   └── product_variant.py
    ├── commerce/
    │   ├── cart.py
    │   └── order.py
    │   └── order_history.py
    ├── social/
    │   ├── review.py
    │   └── wishlist.py
    └── ai/
        ├── user_event.py
        └── ai_interaction.py
```

El dominio de comercio separa carrito y pedido porque tienen ciclos de vida
distintos: el carrito es temporal y editable, mientras que el pedido representa
un registro histórico de la compra. El archivo `app/models/__init__.py` funciona
como punto de exportación y garantiza que Flask-Migrate registre todos los
modelos.

Las rutas HTTP son adaptadores del protocolo: reciben JSON, invocan un servicio
y serializan la respuesta. Las reglas reutilizables de negocio viven en
`app/services/`, organizadas por el mismo dominio que los modelos. Así, la web,
la aplicación móvil y las tareas internas pueden compartir reglas como la
validación de inventario, la creación de reseñas y el registro de eventos.

## Requisitos

- Python 3.11+
- SQLite para desarrollo o PostgreSQL para producción

## Instalación

En PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

## Base de datos y migraciones

```powershell
$env:FLASK_APP = "run.py"
flask db init                 # solo una vez si migrations aún no existe
flask db migrate -m "create initial commerce schema"
flask db upgrade
flask seed
```

Para PostgreSQL, cambia `DATABASE_URL` en `.env`, por ejemplo:
`postgresql+psycopg://usuario:password@localhost:5432/vokter`.

## Ejecutar

```powershell
flask run --debug
```

La comprobación inicial está disponible en
`GET http://localhost:5000/api/health`.

## Frontend React

El frontend vive en la carpeta `frontend/` y es una aplicación independiente
dentro del mismo repositorio. Usa React, TypeScript, Vite y Tailwind CSS.

En una segunda terminal de PowerShell:

```powershell
Set-Location frontend
Copy-Item .env.example .env
npm install
npm run dev
```

La aplicación web estará disponible en `http://localhost:5173`. Su URL base
para la API se configura con `VITE_API_URL` en `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_MOBILE_DOWNLOAD_URL=
```

Para crear una compilación de producción:

```powershell
Set-Location frontend
npm run build
npm run preview
```

El backend y el frontend mantienen dependencias y comandos separados, pero
comparten el contrato [openapi.yaml](./openapi.yaml) y se entregan como una
solución integral.

## API HTTP

Los endpoints funcionales se versionan bajo `/api/v1` y devuelven respuestas
JSON con la forma `{"data": ...}` para éxitos y
`{"error": {"code": "...", "message": "...", "request_id": "..."}}` para errores.
Los cuerpos JSON se validan en el borde HTTP: se rechazan campos desconocidos,
tipos incorrectos y valores fuera de rango con `400 validation_error`.

## Configuración por ambiente y CORS

La aplicación carga `.env` localmente y permite seleccionar `development`,
`testing` o `production`. En producción se requiere configurar explícitamente
`SECRET_KEY`. CORS solo se habilita para las rutas `/api/*` y usa:

- `CORS_ORIGINS`: lista separada por comas de orígenes permitidos.
- `CORS_SUPPORTS_CREDENTIALS`: habilita credenciales cuando el frontend lo requiere.
- `CORS_MAX_AGE`: duración en segundos de la caché del preflight.

No se debe usar `*` junto con credenciales. Para producción, se recomienda
definir exclusivamente los dominios web y móvil conocidos.

Endpoints iniciales:

```text
GET    /api/v1/health
GET    /api/v1/catalog/products
GET    /api/v1/catalog/products/<id>
GET    /api/v1/catalog/categories
POST   /api/v1/carts
GET    /api/v1/carts/<id>
POST   /api/v1/carts/<id>/items
PATCH  /api/v1/carts/<id>/items/<item_id>
DELETE /api/v1/carts/<id>/items/<item_id>
POST   /api/v1/social/reviews
POST   /api/v1/ai/events
POST   /api/v1/ai/interactions
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/orders/checkout
GET    /api/v1/orders/<id>
GET    /api/v1/orders
GET    /api/v1/users/me/addresses
POST   /api/v1/users/me/addresses
PATCH  /api/v1/users/me/addresses/<id>
DELETE /api/v1/users/me/addresses/<id>
GET    /api/v1/social/products/<id>/reviews
PATCH  /api/v1/social/reviews/<id>
DELETE /api/v1/social/reviews/<id>
GET    /api/v1/wishlist
POST   /api/v1/wishlist/items
DELETE /api/v1/wishlist/items/<id>
POST   /api/v1/carts/merge
GET    /api/v1/carts/current
DELETE /api/v1/carts/<id>/items
POST   /api/v1/orders/<id>/cancel
PATCH  /api/v1/orders/<id>/status
PATCH  /api/v1/orders/<id>/payment
PATCH  /api/v1/orders/<id>/shipment
```

Las rutas solo coordinan HTTP y validación básica. La serialización reusable
está en `app/api/serializers.py`; los modelos continúan aislados en
`app/models/`. La autenticación, autorización y los servicios de negocio se
organizan en `app/services/`.

Los carritos autenticados requieren JWT. Los carritos anónimos se crean con
`session_key` y deben enviarse después mediante `X-Cart-Session`; sin alguno
de esos mecanismos la API rechaza el acceso. El usuario autenticado siempre se
obtiene del token, nunca de un `user_id` enviado por el cliente.

El catálogo permite filtrar por `category`, `brand`, `min_price` y `max_price`,
y ordenar con `sort=newest|price_asc|price_desc|name`. La metadata incluye
`total` y `pages`.

El registro y login entregan un access token de dos horas y un refresh token de
treinta días. Los refresh tokens se persisten como sesiones, se rotan en cada
renovación y pueden revocarse mediante `/api/v1/auth/logout`.
Los pedidos mantienen historial de estados. Un cliente puede cancelar pedidos
pendientes o pagados; la actualización administrativa de estados requiere rol
`admin`.

El checkout crea automáticamente un pago y un envío asociados al pedido:

```json
{
  "cart_id": 1,
  "shipping_address": "Calle 1 # 2-3",
  "payment_method": "card"
}
```

Los métodos disponibles son `card`, `paypal` y `cash_on_delivery`. En esta
fase el pago queda en estado `pending` y usa el proveedor interno `manual`;
la integración con una pasarela real se incorporará mediante un adaptador sin
acoplar el dominio a un proveedor. Los cambios administrativos de pago y
envío se realizan con `/payment` y `/shipment`.

Para fusionar un carrito anónimo tras iniciar sesión:

```http
POST /api/v1/carts/merge
Authorization: Bearer <access_token>
```

```json
{"session_key": "session-abc"}
```

El usuario autenticado mantiene un único carrito activo. Se puede consultar
con `GET /api/v1/carts/current` y vaciar con
`DELETE /api/v1/carts/<id>/items`.

El checkout requiere una clave de idempotencia:

```http
POST /api/v1/orders/checkout
Idempotency-Key: checkout-unique-key
```

Una repetición con la misma clave y usuario devuelve el pedido original sin
volver a descontar inventario ni crear otro pedido.

## Validación y pruebas

Los casos críticos están cubiertos en
[`tests/test_api.py`](</C:/Users/Jorge/Documents/Programacion/Entrevista Main/tests/test_api.py>)
y se ejecutan con:

```powershell
py -3 -m unittest discover -s tests
```

El contrato inicial está documentado en
[`openapi.yaml`](</C:/Users/Jorge/Documents/Programacion/Entrevista Main/openapi.yaml>).

## Autenticación y checkout

`POST /api/v1/auth/register` y `POST /api/v1/auth/login` devuelven un JWT.
Las rutas protegidas requieren:

```text
Authorization: Bearer <access_token>
```

El checkout recibe un carrito del usuario autenticado:

```json
{
  "cart_id": 1,
  "shipping_address": "Calle 1 # 2-3"
}
```

El servicio de pedidos valida pertenencia, carrito no vacío e inventario;
crea el pedido y sus líneas históricas, descuenta existencias, marca el
carrito como `checked_out` y elimina sus items dentro de una única
transacción. Los precios y nombres quedan copiados en `order_items` para
preservar el historial aunque cambie el catálogo.

## Próximos módulos recomendados

1. Autenticación JWT y serialización/versionado de endpoints (`/api/v1`).
2. Servicios de catálogo, carrito, checkout y reseñas con validación.
3. Integración de almacenamiento de imágenes y pagos.
4. Cliente React y aplicación móvil que consuman el mismo contrato OpenAPI.
5. Pipeline de eventos para recomendaciones y búsqueda asistida por IA.
