// Dedicated API client for the admin panel. Kept separate from lib/api.ts so
// an administrator session never shares (or clobbers) a storefront customer
// session in the same browser: tokens are stored under their own key and
// every admin route lives under /admin/*.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '')

const ADMIN_TOKENS_KEY = 'vokter.admin_tokens'

export type AdminTokens = { access_token: string; refresh_token: string }

export function getStoredAdminTokens(): AdminTokens | null {
  const raw = localStorage.getItem(ADMIN_TOKENS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminTokens
  } catch {
    return null
  }
}

export function storeAdminTokens(tokens: AdminTokens | null) {
  if (tokens) localStorage.setItem(ADMIN_TOKENS_KEY, JSON.stringify(tokens))
  else localStorage.removeItem(ADMIN_TOKENS_KEY)
}

export class AdminApiError extends Error {
  code: string
  status: number

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
  }
}

let refreshPromise: Promise<AdminTokens | null> | null = null

async function refreshAdminTokens(): Promise<AdminTokens | null> {
  const tokens = getStoredAdminTokens()
  if (!tokens?.refresh_token) return null
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    })
    if (!response.ok) return null
    const body = await response.json()
    const next: AdminTokens = body.data
    storeAdminTokens(next)
    return next
  } catch {
    return null
  }
}

async function adminFetch<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const tokens = getStoredAdminTokens()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  if (tokens?.access_token) headers.set('Authorization', `Bearer ${tokens.access_token}`)

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (response.status === 401 && tokens?.refresh_token && !isRetry) {
    refreshPromise ??= refreshAdminTokens().finally(() => {
      refreshPromise = null
    })
    const refreshed = await refreshPromise
    if (refreshed) return adminFetch<T>(path, options, true)
    storeAdminTokens(null)
  }

  if (response.status === 204) return undefined as T

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const errorBody = body as { error?: { message?: string; code?: string } } | null
    throw new AdminApiError(
      errorBody?.error?.message ?? 'Ocurrió un error inesperado',
      response.status,
      errorBody?.error?.code ?? 'unknown_error',
    )
  }

  return body as T
}

// ---------------------------------------------------------------------------
// Auth (captcha + dedicated admin login)
// ---------------------------------------------------------------------------

export type CaptchaChallenge = { question: string; token: string; expires_in: number }

export type AdminUser = {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  role: 'customer' | 'admin'
  is_active: boolean
  created_at?: string
  stats?: { orders_count: number; total_spent: string }
}

export async function getCaptcha(): Promise<CaptchaChallenge> {
  const response = await adminFetch<{ data: CaptchaChallenge }>('/admin/auth/captcha', {})
  return response.data
}

export async function adminLogin(input: {
  email: string
  password: string
  captcha_token: string
  captcha_answer: number
}): Promise<{ user: AdminUser; access_token: string; refresh_token: string }> {
  const response = await adminFetch<{ data: { user: AdminUser; access_token: string; refresh_token: string } }>(
    '/admin/auth/login',
    { method: 'POST', body: JSON.stringify(input) },
  )
  return response.data
}

export async function getAdminProfile(): Promise<AdminUser> {
  const response = await adminFetch<{ data: AdminUser }>('/auth/me', {})
  return response.data
}

export function adminLogout() {
  storeAdminTokens(null)
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DashboardSummary = {
  kpis: {
    active_orders: number
    completed_orders: number
    total_orders: number
    sales_month_total: string
    sales_all_time_total: string
    customers_count: number
    products_count: number
    average_rating: number | null
  }
  orders_by_status: { status: string; label: string; count: number; percentage: number }[]
  low_stock_alerts: {
    variant_id: number
    product_name: string
    variant_name: string
    sku: string
    stock_quantity: number
    threshold: number
  }[]
  recent_orders: {
    id: number
    customer_name: string
    customer_email: string
    status: string
    status_label: string
    total: string
    items_count: number
    payment_status: string | null
    created_at: string
  }[]
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await adminFetch<{ data: DashboardSummary }>('/admin/dashboard', {})
  return response.data
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type AdminOrder = {
  id: number
  user_id: number
  status: string
  total: string
  shipping_address: string | null
  created_at: string
  customer?: { id: number; name: string; email: string }
  items: { id: number; variant_id: number; product_name: string; quantity: number; unit_price: string | null }[]
  status_history: { status: string; note: string | null; created_at: string }[]
  payment: { id: number; status: string; method: string; amount: string | null } | null
  shipment: { id: number; status: string; tracking_number: string | null; carrier: string | null } | null
}

type PagedResponse<T> = { data: T[]; meta: { page: number; per_page: number; count: number; total: number; pages: number } }

export async function listAdminOrders(params: { page?: number; status?: string; q?: string } = {}): Promise<PagedResponse<AdminOrder>> {
  const query = new URLSearchParams({ page: String(params.page ?? 1) })
  if (params.status) query.set('status', params.status)
  if (params.q) query.set('q', params.q)
  return adminFetch<PagedResponse<AdminOrder>>(`/admin/orders?${query.toString()}`, {})
}

export async function getAdminOrder(id: number): Promise<AdminOrder> {
  const response = await adminFetch<{ data: AdminOrder }>(`/admin/orders/${id}`, {})
  return response.data
}

export async function updateAdminOrderStatus(id: number, status: string): Promise<AdminOrder> {
  const response = await adminFetch<{ data: AdminOrder }>(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return response.data
}

export async function updateAdminOrderPayment(id: number, status: string): Promise<AdminOrder> {
  const response = await adminFetch<{ data: AdminOrder }>(`/admin/orders/${id}/payment`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return response.data
}

export async function updateAdminOrderShipment(
  id: number,
  input: { status: string; tracking_number?: string; carrier?: string },
): Promise<AdminOrder> {
  const response = await adminFetch<{ data: AdminOrder }>(`/admin/orders/${id}/shipment`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return response.data
}

// ---------------------------------------------------------------------------
// Products, variants & categories
// ---------------------------------------------------------------------------

export type AdminCategory = { id: number; name: string; slug: string; description?: string | null; is_active: boolean }

export type AdminVariant = {
  id: number
  sku: string
  name: string
  price: string
  stock_quantity: number
  is_active: boolean
}

export type AdminProduct = {
  id: number
  name: string
  slug: string
  description?: string | null
  brand?: string | null
  base_price: string
  is_active: boolean
  is_featured: boolean
  categories: AdminCategory[]
  variants?: AdminVariant[]
  images?: AdminProductImage[]
  reviews: { count: number; average: number | null }
}

export type AdminProductImage = {
  id: number
  url: string
  alt_text: string | null
  sort_order: number
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const response = await adminFetch<{ data: AdminCategory[] }>('/admin/catalog/categories', {})
  return response.data
}

export async function createAdminCategory(input: { name: string; slug: string; description?: string; is_active?: boolean }): Promise<AdminCategory> {
  const response = await adminFetch<{ data: AdminCategory }>('/admin/catalog/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function updateAdminCategory(id: number, input: Partial<{ name: string; slug: string; description: string; is_active: boolean }>): Promise<AdminCategory> {
  const response = await adminFetch<{ data: AdminCategory }>(`/admin/catalog/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function deleteAdminCategory(id: number): Promise<AdminCategory> {
  const response = await adminFetch<{ data: AdminCategory }>(`/admin/catalog/categories/${id}`, { method: 'DELETE' })
  return response.data
}

export async function listAdminProducts(params: { q?: string; page?: number } = {}): Promise<PagedResponse<AdminProduct>> {
  const query = new URLSearchParams({ page: String(params.page ?? 1) })
  if (params.q) query.set('q', params.q)
  return adminFetch<PagedResponse<AdminProduct>>(`/admin/catalog/products?${query.toString()}`, {})
}

export async function getAdminProduct(id: number): Promise<AdminProduct> {
  const response = await adminFetch<{ data: AdminProduct }>(`/admin/catalog/products/${id}`, {})
  return response.data
}

export async function createAdminProduct(input: {
  name: string
  slug: string
  description?: string
  brand?: string
  base_price: string
  is_active?: boolean
  is_featured?: boolean
  category_ids?: number[]
}): Promise<AdminProduct> {
  const response = await adminFetch<{ data: AdminProduct }>('/admin/catalog/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function updateAdminProduct(id: number, input: Record<string, unknown>): Promise<AdminProduct> {
  const response = await adminFetch<{ data: AdminProduct }>(`/admin/catalog/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function deleteAdminProduct(id: number): Promise<AdminProduct> {
  const response = await adminFetch<{ data: AdminProduct }>(`/admin/catalog/products/${id}`, { method: 'DELETE' })
  return response.data
}

export async function createAdminVariant(productId: number, input: { sku: string; name: string; price: string; stock_quantity: number; is_active?: boolean }): Promise<AdminVariant> {
  const response = await adminFetch<{ data: AdminVariant }>(`/admin/catalog/products/${productId}/variants`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function updateAdminVariant(id: number, input: Partial<{ sku: string; name: string; price: string; stock_quantity: number; is_active: boolean }>): Promise<AdminVariant> {
  const response = await adminFetch<{ data: AdminVariant }>(`/admin/catalog/variants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return response.data
}

// ---------------------------------------------------------------------------
// Product images
// ---------------------------------------------------------------------------

export async function uploadAdminProductImage(
  productId: number,
  file: File,
  altText?: string,
): Promise<AdminProductImage> {
  const tokens = getStoredAdminTokens()
  const formData = new FormData()
  formData.append('image', file)
  if (altText) formData.append('alt_text', altText)

  const headers = new Headers()
  if (tokens?.access_token) headers.set('Authorization', `Bearer ${tokens.access_token}`)
  // Do NOT set Content-Type — the browser must set it with the multipart boundary

  const response = await fetch(
    `${API_URL}/admin/catalog/products/${productId}/images`,
    { method: 'POST', headers, body: formData },
  )

  let body: unknown = null
  try { body = await response.json() } catch { body = null }

  if (!response.ok) {
    const errorBody = body as { error?: { message?: string; code?: string } } | null
    throw new AdminApiError(
      errorBody?.error?.message ?? 'Error al subir la imagen',
      response.status,
      errorBody?.error?.code ?? 'upload_error',
    )
  }

  return (body as { data: AdminProductImage }).data
}

export async function deleteAdminProductImage(imageId: number): Promise<void> {
  await adminFetch<unknown>(`/admin/catalog/images/${imageId}`, { method: 'DELETE' })
}


export async function listAdminUsers(
  params: { q?: string; role?: string; page?: number; is_active?: boolean } = {},
): Promise<PagedResponse<AdminUser>> {
  const query = new URLSearchParams({ page: String(params.page ?? 1) })
  if (params.q) query.set('q', params.q)
  if (params.role) query.set('role', params.role)
  if (params.is_active !== undefined) query.set('is_active', String(params.is_active))
  return adminFetch<PagedResponse<AdminUser>>(`/admin/users?${query.toString()}`, {})
}

export async function getAdminUserDetail(id: number): Promise<AdminUser> {
  const response = await adminFetch<{ data: AdminUser }>(`/admin/users/${id}`, {})
  return response.data
}

export async function createAdminUser(input: {
  email: string
  password: string
  first_name: string
  last_name: string
  role?: string
  is_active?: boolean
}): Promise<AdminUser> {
  const response = await adminFetch<{ data: AdminUser }>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function updateAdminUser(id: number, input: Record<string, unknown>): Promise<AdminUser> {
  const response = await adminFetch<{ data: AdminUser }>(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function deactivateAdminUser(id: number): Promise<AdminUser> {
  const response = await adminFetch<{ data: AdminUser }>(`/admin/users/${id}`, { method: 'DELETE' })
  return response.data
}
