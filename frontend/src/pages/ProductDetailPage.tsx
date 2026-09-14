import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ApiError,
  createReview,
  getProductBySlug,
  listProductReviews,
  recordEvent,
  type Product,
  type ProductVariant,
  type Review,
} from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useCart } from '../lib/cart-context'
import { useWishlist } from '../lib/wishlist-context'
import { useToast } from '../lib/toast-context'
import { Badge, GlassButton, GlassPanel, Stars } from '../components/ui'

function ReviewForm({ productId, onCreated }: { productId: number; onCreated: (review: Review) => void }) {
  const { isAuthenticated } = useAuth()
  const { push } = useToast()
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isAuthenticated) {
    return <p className="text-sm text-slate-500">Inicia sesión para dejar una reseña de este producto.</p>
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const review = await createReview({ product_id: productId, rating, title: title || undefined, content: content || undefined })
      onCreated(review)
      setTitle('')
      setContent('')
      push('Gracias por tu reseña', 'success')
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'No se pudo publicar la reseña', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Tu calificación:</span>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={`text-xl ${value <= rating ? 'text-amber-300' : 'text-slate-600'}`}
          >
            ★
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Título (opcional)"
        className="glass-input"
      />
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Comparte tu experiencia con este producto…"
        rows={3}
        className="glass-input resize-none"
      />
      <GlassButton type="submit" disabled={submitting}>
        {submitting ? 'Publicando…' : 'Publicar reseña'}
      </GlassButton>
    </form>
  )
}

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { addItem } = useCart()
  const { productIds, toggle } = useWishlist()
  const { push } = useToast()
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<{ count: number; average: number | null }>({ count: 0, average: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    getProductBySlug(slug)
      .then((result) => {
        if (cancelled) return
        setProduct(result)
        setSelectedVariant(result.variants?.[0] ?? null)
        setError('')
        recordEvent({ event_type: 'view_product', product_id: result.id })
      })
      .catch(() => {
        if (!cancelled) setError('No pudimos encontrar este producto.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!product) return
    listProductReviews(product.id)
      .then((result) => {
        setReviews(result.data)
        setSummary({ count: result.summary.total, average: result.summary.average })
      })
      .catch(() => undefined)
  }, [product])

  async function handleAdd() {
    if (!selectedVariant) return
    try {
      await addItem(selectedVariant.id, quantity)
      push('Producto añadido al carrito', 'success')
    } catch (requestError) {
      push(requestError instanceof ApiError ? requestError.message : 'No se pudo añadir el producto', 'error')
    }
  }

  async function handleSave() {
    if (!product) return
    try {
      await toggle(product.id)
    } catch {
      push('Inicia sesión para guardar en tu wishlist', 'error')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-24 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-3xl bg-white/5" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-white/5" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
            <div className="h-24 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center lg:px-8">
        <GlassPanel className="p-10">
          <p className="text-slate-300">{error || 'Producto no encontrado.'}</p>
          <Link to="/" className="mt-4 inline-block text-cyan-300 hover:text-cyan-100">
            ← Volver al catálogo
          </Link>
        </GlassPanel>
      </div>
    )
  }

  const images = product.images && product.images.length > 0 ? product.images : [{ id: 0, url: '', alt_text: product.name, sort_order: 0 }]
  const saved = productIds.has(product.id)
  const inStock = (selectedVariant?.stock_quantity ?? 0) > 0

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
      <nav className="mb-8 text-sm text-slate-500">
        <Link to="/" className="hover:text-cyan-200">
          Catálogo
        </Link>
        {product.categories[0] && (
          <>
            {' '}
            / <span>{product.categories[0].name}</span>
          </>
        )}{' '}
        / <span className="text-slate-300">{product.name}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400/20 via-violet-500/20 to-fuchsia-500/20">
            {images[activeImage]?.url ? (
              <img className="h-full w-full object-cover" src={images[activeImage].url} alt={images[activeImage].alt_text ?? product.name} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-9xl font-black tracking-tighter text-white/10">{product.name.slice(0, 1)}</span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-4 flex gap-3">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setActiveImage(index)}
                  className={`h-16 w-16 overflow-hidden rounded-xl border ${index === activeImage ? 'border-cyan-300' : 'border-white/10'}`}
                >
                  {image.url && <img className="h-full w-full object-cover" src={image.url} alt="" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{product.brand ?? 'Vokter'}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">{product.name}</h1>
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <Stars value={summary.average} /> {summary.average ?? '—'} · {summary.count} reseñas
          </div>
          <p className="mt-6 text-3xl font-semibold text-cyan-100">${selectedVariant?.price ?? product.base_price}</p>
          <p className="mt-4 max-w-lg text-slate-400">{product.description ?? 'Sin descripción disponible por ahora.'}</p>

          {product.variants && product.variants.length > 1 && (
            <div className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Variante</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant)}
                    className={`rounded-xl border px-4 py-2 text-sm transition ${
                      selectedVariant?.id === variant.id
                        ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    {variant.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            {inStock ? <Badge tone="success">En stock ({selectedVariant?.stock_quantity})</Badge> : <Badge tone="danger">Agotado</Badge>}
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-xl border border-white/10 bg-white/5">
              <button className="px-3 py-2 text-lg" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                −
              </button>
              <span className="w-8 text-center">{quantity}</span>
              <button className="px-3 py-2 text-lg" onClick={() => setQuantity((value) => value + 1)}>
                +
              </button>
            </div>
            <GlassButton onClick={handleAdd} disabled={!inStock} className="flex-1 justify-center">
              {inStock ? 'Añadir al carrito' : 'Sin stock'}
            </GlassButton>
            <GlassButton variant="icon" onClick={handleSave} className="h-11 w-11 rounded-xl p-0" aria-label="Guardar en wishlist">
              {saved ? '♥' : '♡'}
            </GlassButton>
          </div>
        </div>
      </div>

      <section className="mt-20">
        <h2 className="text-2xl font-semibold tracking-tight">Reseñas de clientes</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <ReviewForm productId={product.id} onCreated={(review) => setReviews((current) => [review, ...current])} />
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay reseñas para este producto.</p>
            ) : (
              reviews.map((review) => (
                <GlassPanel key={review.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <Stars value={review.rating} />
                    {review.is_verified_purchase && <Badge tone="success">Compra verificada</Badge>}
                  </div>
                  {review.title && <p className="mt-2 font-medium text-slate-100">{review.title}</p>}
                  {review.content && <p className="mt-1 text-sm text-slate-400">{review.content}</p>}
                </GlassPanel>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
