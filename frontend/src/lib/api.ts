const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '')

// ---------------------------------------------------------------------------
// Shared types (mirrors app/api/serializers.py)
// ---------------------------------------------------------------------------

export type Category = {
  id: number
  name: string
  slug: string
  description?: string | null
}

export type ProductVariant = {
  id: number
  sku: string
  name: string
  price: string
  stock_quantity: number
  is_active: boolean
}

export type ProductImage = {
  id: number
  url: string
  alt_text?: string | null
  sort_order: number
}

export type Product = {
  id: number
  name: string
  slug: string
  description?: string | null
  brand?: string | null
  base_price: string
  is_active: boolean
  is_featured: boolean
  categories: Category[]
  reviews: { count: number; average: number | null }
  images?: ProductImage[]
  variants?: ProductVariant[]
}

export type User = {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  role: 'customer' | 'admin'
  is_active: boolean
}

export type CartItem = {
  id: number
  variant_id: number
  quantity: number
  unit_price: string | null
}

export type Cart = {
  id: number
  user_id: number | null
  session_key: string | null
  status: string
  items: CartItem[]
  total: string
}

export type Address = {
  id: number
  label: string | null
  street: string
  city: string
  state: string | null
  postal_code: string | null
  country: string
  is_default: boolean
}

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded'
export type PaymentMethod = 'card' | 'paypal' | 'cash_on_delivery'

export type Order = {
  id: number
  user_id: number
  status: OrderStatus
  total: string
  shipping_address: string | null
  shipping_address_snapshot: Record<string, unknown> | null
  items: {
    id: number
    variant_id: number
    product_name: string
    quantity: number
    unit_price: string | null
  }[]
  status_history: { status: OrderStatus; note: string | null; created_at: string }[]
  payment: {
    id: number
    status: PaymentStatus
    method: PaymentMethod
    amount: string | null
    provider: string | null
    provider_reference: string | null
  } | null
  shipment: {
    id: number
    status: string
    tracking_number: string | null
    carrier: string | null
  } | null
}

export type Review = {
  id: number
  user_id: number
  product_id: number
  rating: number
  title: string | null
  content: string | null
  is_verified_purchase: boolean
}

export type Wishlist = {
  id: number
  name: string
  items: { id: number; product: Product }[]
}

// ---------------------------------------------------------------------------
// Token + cart session persistence
// ---------------------------------------------------------------------------

const TOKENS_KEY = 'vokter.tokens'
const CART_SESSION_KEY = 'vokter.cart_session'

export type Tokens = { access_token: string; refresh_token: string }

export function getStoredTokens(): Tokens | null {
  const raw = localStorage.getItem(TOKENS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Tokens
  } catch {
    return null
  }
}

export function storeTokens(tokens: Tokens | null) {
  if (tokens) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  else localStorage.removeItem(TOKENS_KEY)
}

export function getCartSessionKey(): string {
  let key = localStorage.getItem(CART_SESSION_KEY)
  if (!key) {
    key = crypto.randomUUID()
    localStorage.setItem(CART_SESSION_KEY, key)
  }
  return key
}

export function clearCartSessionKey() {
  localStorage.removeItem(CART_SESSION_KEY)
}

// ---------------------------------------------------------------------------
// Core fetch wrapper with auth + refresh handling
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  code: string
  status: number
  requestId?: string

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

let refreshPromise: Promise<Tokens | null> | null = null

async function refreshTokens(): Promise<Tokens | null> {
  const tokens = getStoredTokens()
  if (!tokens?.refresh_token) return null
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    })
    if (!response.ok) return null
    const body = await response.json()
    const next: Tokens = body.data
    storeTokens(next)
    return next
  } catch {
    return null
  }
}

type FetchOptions = RequestInit & { skipAuth?: boolean; skipCartSession?: boolean }

async function apiFetch<T>(path: string, options: FetchOptions = {}, isRetry = false): Promise<T> {
  const tokens = getStoredTokens()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  if (!options.skipAuth && tokens?.access_token) {
    headers.set('Authorization', `Bearer ${tokens.access_token}`)
  }
  if (!options.skipCartSession && !tokens?.access_token) {
    headers.set('X-Cart-Session', getCartSessionKey())
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (response.status === 401 && tokens?.refresh_token && !isRetry && !options.skipAuth) {
    refreshPromise ??= refreshTokens().finally(() => {
      refreshPromise = null
    })
    const refreshed = await refreshPromise
    if (refreshed) return apiFetch<T>(path, options, true)
    storeTokens(null)
  }

  if (response.status === 204) return undefined as T

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const errorBody = body as { error?: { message?: string; code?: string; request_id?: string } } | null
    throw new ApiError(
      errorBody?.error?.message ?? 'Ocurrió un error inesperado',
      response.status,
      errorBody?.error?.code ?? 'unknown_error',
      errorBody?.error?.request_id,
    )
  }

  return body as T
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

type ProductListResponse = {
  data: Product[]
  meta: { page: number; per_page: number; count: number; total: number; pages: number }
}

export async function getProducts(params: {
  search?: string
  category?: string
  brand?: string
  available?: boolean
  sort?: string
  page?: number
}): Promise<ProductListResponse> {
  const query = new URLSearchParams({
    q: params.search ?? '',
    page: String(params.page ?? 1),
    per_page: '12',
    sort: params.sort ?? 'newest',
  })
  if (params.category) query.set('category', params.category)
  if (params.brand) query.set('brand', params.brand)
  if (params.available) query.set('available', 'true')
  return apiFetch<ProductListResponse>(`/catalog/products?${query.toString()}`, { skipAuth: true, skipCartSession: true })
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const response = await apiFetch<{ data: Product }>(`/catalog/products/slug/${slug}`, {
    skipAuth: true,
    skipCartSession: true,
  })
  return response.data
}

export async function getCategories(): Promise<Category[]> {
  const response = await apiFetch<{ data: Category[] }>('/catalog/categories', { skipAuth: true, skipCartSession: true })
  return response.data
}

export async function getFilters(): Promise<{ brands: string[]; price: { min: string | null; max: string | null } }> {
  const response = await apiFetch<{ data: { brands: string[]; price: { min: string | null; max: string | null } } }>(
    '/catalog/filters',
    { skipAuth: true, skipCartSession: true },
  )
  return response.data
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function register(input: {
  email: string
  password: string
  first_name?: string
  last_name?: string
}): Promise<{ user: User; access_token: string; refresh_token: string }> {
  const response = await apiFetch<{ data: { user: User; access_token: string; refresh_token: string } }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify(input), skipAuth: true, skipCartSession: true },
  )
  return response.data
}

export async function login(input: { email: string; password: string }): Promise<{
  user: User
  access_token: string
  refresh_token: string
}> {
  const response = await apiFetch<{ data: { user: User; access_token: string; refresh_token: string } }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(input), skipAuth: true, skipCartSession: true },
  )
  return response.data
}

export async function getMe(): Promise<User> {
  const response = await apiFetch<{ data: User }>('/auth/me', { skipCartSession: true })
  return response.data
}

export async function updateProfile(input: { email?: string; first_name?: string; last_name?: string }): Promise<User> {
  const response = await apiFetch<{ data: User }>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
    skipCartSession: true,
  })
  return response.data
}

export async function changePassword(input: { current_password: string; new_password: string }): Promise<void> {
  await apiFetch<void>('/auth/me/password', { method: 'PATCH', body: JSON.stringify(input), skipCartSession: true })
}

export async function logout(): Promise<void> {
  const tokens = getStoredTokens()
  if (!tokens) return
  try {
    await apiFetch<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      skipCartSession: true,
    })
  } finally {
    storeTokens(null)
  }
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export async function getCurrentCart(): Promise<Cart> {
  const tokens = getStoredTokens()
  if (tokens?.access_token) {
    const response = await apiFetch<{ data: Cart }>('/carts/current')
    return response.data
  }
  const response = await apiFetch<{ data: Cart }>('/carts', {
    method: 'POST',
    body: JSON.stringify({ session_key: getCartSessionKey() }),
  })
  return response.data
}

export async function addCartItem(cartId: number, variantId: number, quantity = 1): Promise<Cart> {
  const response = await apiFetch<{ data: Cart }>(`/carts/${cartId}/items`, {
    method: 'POST',
    body: JSON.stringify({ variant_id: variantId, quantity }),
  })
  return response.data
}

export async function updateCartItem(cartId: number, itemId: number, quantity: number): Promise<Cart> {
  const response = await apiFetch<{ data: Cart }>(`/carts/${cartId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  })
  return response.data
}

export async function removeCartItem(cartId: number, itemId: number): Promise<Cart> {
  const response = await apiFetch<{ data: Cart }>(`/carts/${cartId}/items/${itemId}`, { method: 'DELETE' })
  return response.data
}

export async function mergeCart(): Promise<Cart> {
  const sessionKey = localStorage.getItem(CART_SESSION_KEY)
  if (!sessionKey) return getCurrentCart()
  try {
    const response = await apiFetch<{ data: Cart }>('/carts/merge', {
      method: 'POST',
      body: JSON.stringify({ session_key: sessionKey }),
    })
    return response.data
  } catch {
    return getCurrentCart()
  } finally {
    clearCartSessionKey()
  }
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export async function listAddresses(): Promise<Address[]> {
  const response = await apiFetch<{ data: Address[] }>('/users/me/addresses', { skipCartSession: true })
  return response.data
}

export async function createAddress(input: Omit<Address, 'id'>): Promise<Address> {
  const response = await apiFetch<{ data: Address }>('/users/me/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
    skipCartSession: true,
  })
  return response.data
}

export async function updateAddress(id: number, input: Partial<Omit<Address, 'id'>>): Promise<Address> {
  const response = await apiFetch<{ data: Address }>(`/users/me/addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    skipCartSession: true,
  })
  return response.data
}

export async function deleteAddress(id: number): Promise<void> {
  await apiFetch<void>(`/users/me/addresses/${id}`, { method: 'DELETE', skipCartSession: true })
}

// ---------------------------------------------------------------------------
// Orders / checkout
// ---------------------------------------------------------------------------

export async function checkout(input: {
  cart_id: number
  address_id?: number
  shipping_address?: string
  payment_method: PaymentMethod
  idempotencyKey: string
}): Promise<Order> {
  const response = await apiFetch<{ data: Order }>('/orders/checkout', {
    method: 'POST',
    body: JSON.stringify({
      cart_id: input.cart_id,
      address_id: input.address_id,
      shipping_address: input.shipping_address,
      payment_method: input.payment_method,
    }),
    headers: { 'Idempotency-Key': input.idempotencyKey },
    skipCartSession: true,
  })
  return response.data
}

export async function listOrders(params: { page?: number; status?: string } = {}): Promise<{
  data: Order[]
  meta: { page: number; per_page: number; total: number; pages: number }
}> {
  const query = new URLSearchParams({ page: String(params.page ?? 1) })
  if (params.status) query.set('status', params.status)
  return apiFetch(`/orders?${query.toString()}`, { skipCartSession: true })
}

export async function getOrder(id: number): Promise<Order> {
  const response = await apiFetch<{ data: Order }>(`/orders/${id}`, { skipCartSession: true })
  return response.data
}

export async function cancelOrder(id: number): Promise<Order> {
  const response = await apiFetch<{ data: Order }>(`/orders/${id}/cancel`, { method: 'POST', skipCartSession: true })
  return response.data
}

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

export async function getWishlist(): Promise<Wishlist> {
  const response = await apiFetch<{ data: Wishlist }>('/wishlist', { skipCartSession: true })
  return response.data
}

export async function addWishlistItem(productId: number): Promise<Wishlist> {
  const response = await apiFetch<{ data: Wishlist }>('/wishlist/items', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
    skipCartSession: true,
  })
  return response.data
}

export async function removeWishlistItem(itemId: number): Promise<Wishlist> {
  const response = await apiFetch<{ data: Wishlist }>(`/wishlist/items/${itemId}`, {
    method: 'DELETE',
    skipCartSession: true,
  })
  return response.data
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function listProductReviews(
  productId: number,
  page = 1,
): Promise<{
  data: Review[]
  summary: { total: number; average: number | null; distribution: Record<string, number> }
  meta: { pages: number; total: number }
}> {
  return apiFetch(`/social/products/${productId}/reviews?page=${page}`, { skipAuth: true, skipCartSession: true })
}

export async function createReview(input: {
  product_id: number
  rating: number
  title?: string
  content?: string
}): Promise<Review> {
  const response = await apiFetch<{ data: Review }>('/social/reviews', {
    method: 'POST',
    body: JSON.stringify(input),
    skipCartSession: true,
  })
  return response.data
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

export type UserEventType = 'view_product' | 'search' | 'add_to_cart' | 'purchase' | 'review'

export async function recordEvent(input: {
  event_type: UserEventType
  product_id?: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const tokens = getStoredTokens()
    await apiFetch<void>('/ai/events', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        session_key: tokens?.access_token ? undefined : getCartSessionKey(),
      }),
      skipAuth: !tokens?.access_token,
      skipCartSession: true,
    })
  } catch {
    // Behavioral tracking must never break the user experience.
  }
}

export type AIInteractionResult = {
  id: number
  status: string
  response: string | null
  provider?: string | null
  model?: string | null
}

export async function createAiInteraction(input: { use_case: string; prompt: string }): Promise<AIInteractionResult> {
  const tokens = getStoredTokens()
  const res = await apiFetch<{ data: AIInteractionResult }>('/ai/interactions', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      session_key: tokens?.access_token ? undefined : getCartSessionKey(),
    }),
    skipAuth: !tokens?.access_token,
  })
  return res.data
}
