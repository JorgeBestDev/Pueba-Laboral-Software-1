import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getCategories, getFilters, getProductBySlug, getProducts, recordEvent, type Category, type Product } from '../lib/api'
import { useCart } from '../lib/cart-context'
import { useWishlist } from '../lib/wishlist-context'
import { useToast } from '../lib/toast-context'
import { GlassButton, GlassInput, GlassPanel, Stars } from '../components/ui'

function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const { productIds, toggle } = useWishlist()
  const { push } = useToast()
  const image = product.images?.[0]
  const saved = productIds.has(product.id)

  async function handleAdd(event: React.MouseEvent) {
    event.preventDefault()
    try {
      // The catalog list payload omits variants for a lighter response, so resolve
      // the default variant from the product detail before adding to the cart.
      const variant = product.variants?.[0] ?? (await getProductBySlug(product.slug)).variants?.[0]
      if (!variant) {
        push('Este producto no tiene variantes disponibles', 'error')
        return
      }
      await addItem(variant.id, 1)
      push('Producto añadido al carrito', 'success')
    } catch {
      push('No se pudo añadir el producto', 'error')
    }
  }

  async function handleSave(event: React.MouseEvent) {
    event.preventDefault()
    try {
      await toggle(product.id)
    } catch {
      push('Inicia sesión para guardar en tu wishlist', 'error')
    }
  }

  return (
    <Link to={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400/20 via-violet-500/20 to-fuchsia-500/20">
        {image ? (
          <img className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={image.url} alt={image.alt_text ?? product.name} />
        ) : (
          <div className="flex h-full items-end p-5">
            <span className="text-7xl font-black tracking-tighter text-white/10">{product.name.slice(0, 1)}</span>
          </div>
        )}
        {product.is_featured && <span className="absolute left-4 top-4 rounded-full border border-cyan-200/20 bg-cyan-300/15 px-3 py-1 text-xs font-semibold text-cyan-100">Featured</span>}
        <GlassButton variant="icon" className="absolute right-4 top-4 h-10 w-10 rounded-full p-0" onClick={handleSave} aria-label="Guardar en wishlist">
          {saved ? '♥' : '♡'}
        </GlassButton>
        <GlassButton className="absolute bottom-4 left-4 right-4 opacity-0 transition group-hover:opacity-100" onClick={handleAdd}>
          Añadir al carrito
        </GlassButton>
      </div>
      <div className="mt-4 flex justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{product.brand ?? product.categories[0]?.name ?? 'Collection'}</p>
          <h3 className="mt-1 font-medium text-slate-100">{product.name}</h3>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <Stars value={product.reviews.average} /> ({product.reviews.count})
          </div>
        </div>
        <p className="font-semibold text-cyan-100">${product.base_price}</p>
      </div>
    </Link>
  )
}

export function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [sort, setSort] = useState('newest')
  const [available, setAvailable] = useState(false)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setError('Conecta la API para cargar el catálogo.'))
    getFilters().then((filters) => setBrands(filters.brands)).catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getProducts({ search, category, brand, available, sort, page })
      .then((result) => {
        if (cancelled) return
        setProducts(result.data)
        setPages(result.meta.pages)
        setError('')
      })
      .catch((requestError: Error) => {
        if (!cancelled) setError(requestError.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, category, brand, available, sort, page])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    const trimmed = searchInput.trim()
    setPage(1)
    setSearch(trimmed)
    if (trimmed) recordEvent({ event_type: 'search', metadata: { query: trimmed } })
  }

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setCategory('')
    setBrand('')
    setAvailable(false)
    setPage(1)
  }

  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-28">
        <div>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-cyan-300">The intelligent marketplace</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.05em] text-white sm:text-7xl">
            Curated objects for your <span className="text-cyan-200">next chapter.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            A considered collection of products, powered by discovery that feels personal.
          </p>
          <form onSubmit={submitSearch} className="mt-8 flex max-w-xl gap-3">
            <GlassInput
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search products, brands or SKUs..."
            />
            <GlassButton type="submit">Search</GlassButton>
          </form>
        </div>
        <GlassPanel className="min-h-72 overflow-hidden p-2 sm:min-h-96">
          <div className="flex h-full items-end rounded-2xl bg-gradient-to-br from-cyan-300/30 via-violet-500/30 to-fuchsia-500/30 p-7">
            <div>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-cyan-100">Curated drop 01</span>
              <p className="mt-4 max-w-xs text-3xl font-semibold tracking-tight">Made for the beautifully unfinished.</p>
            </div>
          </div>
        </GlassPanel>
      </section>

      <section id="catalog" className="mx-auto grid max-w-7xl gap-8 px-5 pb-24 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside>
          <GlassPanel className="sticky top-24 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Filters</h2>
              <button onClick={resetFilters} className="text-xs text-cyan-300 hover:text-cyan-100">
                Clear
              </button>
            </div>
            <label className="mt-7 block text-xs uppercase tracking-widest text-slate-500">Category</label>
            <div className="mt-3 space-y-2">
              {categories.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCategory(item.slug)
                    setPage(1)
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    category === item.slug ? 'bg-cyan-300/15 text-cyan-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <label className="mt-7 block text-xs uppercase tracking-widest text-slate-500">Brand</label>
            <select
              value={brand}
              onChange={(event) => {
                setBrand(event.target.value)
                setPage(1)
              }}
              className="glass-input mt-3"
            >
              <option value="">All brands</option>
              {brands.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <label className="mt-6 flex cursor-pointer items-center gap-3 text-sm text-slate-300">
              <input
                checked={available}
                onChange={(event) => {
                  setAvailable(event.target.checked)
                  setPage(1)
                }}
                type="checkbox"
                className="accent-cyan-300"
              />{' '}
              In stock only
            </label>
          </GlassPanel>
        </aside>
        <div>
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm text-slate-500">Discover the edit</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">All products</h2>
            </div>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value)
                setPage(1)
              }}
              className="glass-input w-auto"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name">Name</option>
            </select>
          </div>
          {error && <GlassPanel className="mb-6 border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</GlassPanel>}
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="aspect-[4/5] animate-pulse rounded-3xl bg-white/5" />
              ))}
            </div>
          ) : products.length ? (
            <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <GlassPanel className="p-10 text-center text-slate-400">No encontramos productos con esos filtros.</GlassPanel>
          )}
          <div className="mt-10 flex justify-center gap-2">
            {Array.from({ length: pages }, (_, index) => index + 1)
              .slice(0, 5)
              .map((item) => (
                <GlassButton key={item} variant={item === page ? 'primary' : 'ghost'} onClick={() => setPage(item)} className="h-10 w-10 justify-center p-0">
                  {item}
                </GlassButton>
              ))}
          </div>
        </div>
      </section>
    </>
  )
}
