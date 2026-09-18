export type Tokens = { access_token: string; refresh_token: string }

export type User = {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  role: 'customer' | 'admin'
  is_active: boolean
}

export type ProductVariant = { id: number; sku: string; name: string; price: string; stock_quantity: number; is_active: boolean }
export type ProductImage = { id: number; url: string; alt_text?: string | null; sort_order: number }
export type Category = { id: number; name: string; slug: string; description?: string | null }
export type Product = {
  id: number
  name: string
  slug: string
  description?: string | null
  brand?: string | null
  base_price: string
  categories: Category[]
  reviews: { count: number; average: number | null }
  images?: ProductImage[]
  variants?: ProductVariant[]
}

export type Cart = {
  id: number
  items: {
    id: number
    variant_id: number
    product_name: string
    variant_name: string
    product_slug: string
    image_url: string | null
    available_variants: { id: number; name: string; price: string; stock_quantity: number }[]
    quantity: number
    unit_price: string | null
  }[]
  total: string
}

export type Address = { id: number; label: string | null; street: string; city: string; state: string | null; postal_code: string | null; country: string; is_default: boolean }
export type Order = { id: number; status: string; total: string; created_at?: string; shipment: { status: string; tracking_number: string | null; carrier: string | null } | null }
export type Wishlist = { id: number; name: string; items: { id: number; product: Product }[] }
export type AIInteractionResult = {
  id: number
  status: string
  response: string | null
  provider?: string | null
  model?: string | null
}
