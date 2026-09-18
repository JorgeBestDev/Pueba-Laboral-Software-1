import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import type { Address, AIInteractionResult, Cart, Category, Order, Product, Tokens, User, Wishlist } from './types'

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:5000/api/v1').replace(/\/$/, '')
const TOKENS_KEY = 'vokter.mobile.tokens'
const CART_SESSION_KEY = 'vokter.mobile.cart-session'

let tokens: Tokens | null = null
let cartSessionKey: string | null = null

// SecureStore encrypts values on Android and iOS. Expo does not provide an
// equivalent encrypted store for web, so the browser preview uses localStorage.
// Keeping this behind one API prevents web-only storage calls from reaching
// the native SecureStore implementation.
const storage = {
  async getItem(key: string) {
    if (Platform.OS !== 'web') return SecureStore.getItemAsync(key)
    try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key) }
    catch { return null }
  },
  async setItem(key: string, value: string) {
    if (Platform.OS !== 'web') return SecureStore.setItemAsync(key, value)
    try { localStorage.setItem(key, value) } catch { /* Storage can be disabled by the browser. */ }
  },
  async deleteItem(key: string) {
    if (Platform.OS !== 'web') return SecureStore.deleteItemAsync(key)
    try { localStorage.removeItem(key) } catch { /* Storage can be disabled by the browser. */ }
  },
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function hydrateSession() {
  const [storedTokens, storedCartKey] = await Promise.all([
    storage.getItem(TOKENS_KEY),
    storage.getItem(CART_SESSION_KEY),
  ])
  tokens = storedTokens ? JSON.parse(storedTokens) as Tokens : null
  cartSessionKey = storedCartKey
  return tokens
}

async function setTokens(next: Tokens | null) {
  tokens = next
  if (next) await storage.setItem(TOKENS_KEY, JSON.stringify(next))
  else await storage.deleteItem(TOKENS_KEY)
}

async function getCartSessionKey() {
  if (cartSessionKey) return cartSessionKey
  cartSessionKey = `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await storage.setItem(CART_SESSION_KEY, cartSessionKey)
  return cartSessionKey
}

async function refreshTokens(): Promise<Tokens | null> {
  if (!tokens?.refresh_token) return null
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  })
  if (!response.ok) return null
  const body = await response.json() as { data: Tokens }
  await setTokens(body.data)
  return body.data
}

async function request<T>(path: string, init: RequestInit & { public?: boolean; retry?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!init.public && tokens?.access_token) headers.set('Authorization', `Bearer ${tokens.access_token}`)
  if (!init.public && !tokens?.access_token) headers.set('X-Cart-Session', await getCartSessionKey())

  const response = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (response.status === 401 && tokens?.refresh_token && !init.retry && !init.public) {
    if (await refreshTokens()) return request<T>(path, { ...init, retry: true })
    await setTokens(null)
  }
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null
  if (!response.ok) throw new ApiError(body?.error?.message ?? 'No fue posible completar la solicitud.', response.status)
  return body?.data as T
}

export const mediaUrl = (path?: string) => !path || path.startsWith('http') ? path : `${API_URL.replace(/\/api\/v1$/, '')}${path}`

export const api = {
  // request() unwraps the API envelope ({ data: ... }), so callers receive
  // the actual payload rather than a second, non-existent data property.
  getProducts: (params: { search?: string; category?: string; sort?: string } = {}) => {
    const query = new URLSearchParams({ q: params.search ?? '', per_page: '24', sort: params.sort ?? 'newest' })
    if (params.category) query.set('category', params.category)
    return request<Product[]>(`/catalog/products?${query}`, { public: true })
  },
  getProduct: (slug: string) => request<Product>(`/catalog/products/slug/${slug}`, { public: true }),
  getCategories: () => request<Category[]>('/catalog/categories', { public: true }),
  async login(email: string, password: string) {
    const result = await request<{ user: User; access_token: string; refresh_token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }), public: true })
    await setTokens({ access_token: result.access_token, refresh_token: result.refresh_token })
    return result.user
  },
  async register(input: { email: string; password: string; first_name: string; last_name: string }) {
    const result = await request<{ user: User; access_token: string; refresh_token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(input), public: true })
    await setTokens({ access_token: result.access_token, refresh_token: result.refresh_token })
    return result.user
  },
  getMe: () => request<User>('/auth/me'),
  async logout() {
    const refresh_token = tokens?.refresh_token
    if (refresh_token) await request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token }) }).catch(() => undefined)
    await setTokens(null)
  },
  getCart: () => tokens?.access_token
    ? request<Cart>('/carts/current')
    : request<Cart>('/carts', { method: 'POST', body: JSON.stringify({ session_key: cartSessionKey }) }),
  addCartItem: (cartId: number, variantId: number) => request<Cart>(`/carts/${cartId}/items`, { method: 'POST', body: JSON.stringify({ variant_id: variantId, quantity: 1 }) }),
  updateCartItem: (cartId: number, itemId: number, quantity: number) => request<Cart>(`/carts/${cartId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  removeCartItem: (cartId: number, itemId: number) => request<Cart>(`/carts/${cartId}/items/${itemId}`, { method: 'DELETE' }),
  replaceCartItemVariant: (cartId: number, itemId: number, variantId: number) => request<Cart>(`/carts/${cartId}/items/${itemId}/variant`, { method: 'PATCH', body: JSON.stringify({ variant_id: variantId }) }),
  getAddresses: () => request<Address[]>('/users/me/addresses'),
  getOrders: () => request<Order[]>('/orders'),
  getWishlist: () => request<Wishlist>('/wishlist'),
  checkout: (input: { cart_id: number; shipping_address: string; payment_method: 'card' | 'paypal' | 'cash_on_delivery'; idempotencyKey: string }) => request<Order>('/orders/checkout', { method: 'POST', headers: { 'Idempotency-Key': input.idempotencyKey }, body: JSON.stringify(input) }),
  askAssistant: (prompt: string) => request<AIInteractionResult>('/ai/interactions', { method: 'POST', body: JSON.stringify({ use_case: 'shopping_assistant', prompt }) }),
}
