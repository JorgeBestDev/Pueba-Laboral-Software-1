import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getCategories, getFilters, getProductBySlug, getProducts, recordEvent, resolveMediaUrl, type Category, type Product } from '../lib/api'
import { useCart } from '../lib/cart-context'
import { useWishlist } from '../lib/wishlist-context'
import { useToast } from '../lib/toast-context'
import { Badge, GlassButton, GlassInput, SectionHeader, Stars } from '../components/ui'

function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { addItem } = useCart()
  const { productIds, toggle } = useWishlist()
  const { push } = useToast()
  const image = product.images?.[0]
  const saved = productIds.has(product.id)

  async function handleAdd(event: React.MouseEvent) {
    event.preventDefault()
    try {
      const variant = product.variants?.[0] ?? (await getProductBySlug(product.slug)).variants?.[0]
      if (!variant) {
        push('Este producto no tiene variantes disponibles', 'error')
        return
      }
      await addItem(variant.id, 1, variant.price)
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
      push('Inicia sesión para guardar en tu lista de deseos', 'error')
    }
  }

  return (
    <Link to={`/products/${product.slug}`} className="group block">
      <div className={`relative overflow-hidden product-image-bg ${compact ? 'aspect-[3/4]' : 'aspect-[4/5]'}`}>
        {image ? (
          <img
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            src={resolveMediaUrl(image.url)}
            alt={image.alt_text ?? product.name}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-6xl text-neutral-300">{product.name.slice(0, 1)}</span>
          </div>
        )}
        {product.is_featured && (
          <span className="absolute left-3 top-3 bg-black px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-white">
            Nuevo
          </span>
        )}
        <button
          type="button"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-white/90 text-sm opacity-0 transition group-hover:opacity-100"
          onClick={handleSave}
          aria-label="Guardar en lista de deseos"
        >
          {saved ? '♥' : '♡'}
        </button>
        <GlassButton
          className="absolute bottom-3 left-3 right-3 justify-center opacity-0 transition group-hover:opacity-100"
          onClick={handleAdd}
        >
          Añadir al carrito
        </GlassButton>
      </div>
      <div className="mt-3">
        <h3 className="text-[0.7rem] font-medium uppercase leading-snug tracking-wide text-black">{product.name}</h3>
        <p className="mt-1 text-sm font-bold">${product.base_price}</p>
        {!compact && (
          <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
            <Stars value={product.reviews.average} /> ({product.reviews.count})
          </div>
        )}
      </div>
    </Link>
  )
}

function CategoryCard({ category, product }: { category: Category; product?: Product }) {
  const image = product?.images?.[0]

  return (
    <Link to={`/#catalog`} onClick={() => window.dispatchEvent(new CustomEvent('vokter:filter-category', { detail: category.slug }))} className="group block">
      <div className="aspect-[3/4] overflow-hidden product-image-bg">
        {image ? (
          <img className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={resolveMediaUrl(image.url)} alt={category.name} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-5xl text-neutral-300">{category.name.slice(0, 1)}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

export function CatalogPage({ searchFocus, onSearchFocusHandled }: { searchFocus?: boolean; onSearchFocusHandled?: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [newProducts, setNewProducts] = useState<Product[]>([])
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
  const [newOffset, setNewOffset] = useState(0)

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setError('Conecta la API para cargar el catálogo.'))
    getFilters().then((filters) => setBrands(filters.brands)).catch(() => undefined)
    getProducts({ sort: 'newest', page: 1 })
      .then((result) => setNewProducts(result.data.slice(0, 8)))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const slug = (event as CustomEvent<string>).detail
      setCategory(slug)
      setPage(1)
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })
    }
    window.addEventListener('vokter:filter-category', handler)
    return () => window.removeEventListener('vokter:filter-category', handler)
  }, [])

  useEffect(() => {
    if (searchFocus && onSearchFocusHandled) {
      onSearchFocusHandled()
    }
  }, [searchFocus, onSearchFocusHandled])

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
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })
  }

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setCategory('')
    setBrand('')
    setAvailable(false)
    setPage(1)
  }

  const visibleNew = newProducts.slice(newOffset, newOffset + 4)
  const canPrevNew = newOffset > 0
  const canNextNew = newOffset + 4 < newProducts.length

  return (
    <>
      {/* Hero */}
      <section id="hero" className="mx-auto max-w-[1400px] px-4 py-16 text-center lg:px-8 lg:py-24">
        <p className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-neutral-500">El marketplace inteligente</p>
        <h1 className="font-display mx-auto max-w-4xl text-4xl leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          Objetos curados para tu <em className="italic">próximo capítulo.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-neutral-600">
          Una colección cuidadosamente seleccionada, impulsada por un descubrimiento que se siente personal.
        </p>

        <div className="mx-auto mt-10 flex max-w-lg flex-wrap items-center justify-center gap-8 text-xs text-neutral-600">
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">✦</span>
            <span className="font-medium uppercase tracking-wider">Selección curada</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">◈</span>
            <span className="font-medium uppercase tracking-wider">Precio justo</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">➤</span>
            <span className="font-medium uppercase tracking-wider">Envío nacional</span>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mx-auto mt-10 flex max-w-md gap-0 border border-neutral-300">
          <GlassInput
            id="hero-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar productos, marcas o SKUs..."
            className="border-0"
          />
          <GlassButton type="submit" className="shrink-0 rounded-none">
            Buscar
          </GlassButton>
        </form>
      </section>

      {/* Featured categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
          <SectionHeader title="Categorías destacadas" italicWord="destacadas" viewAllHref="#catalog" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.slice(0, 3).map((cat, index) => (
              <CategoryCard key={cat.id} category={cat} product={products[index]} />
            ))}
          </div>
        </section>
      )}

      {/* Split hero banners */}
      <section className="grid sm:grid-cols-2">
        <div className="relative flex min-h-[420px] items-end justify-end bg-neutral-900 p-8 lg:min-h-[520px] lg:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-black opacity-90" />
          <div className="relative text-right text-white">
            <p className="font-display text-3xl italic lg:text-4xl">Más vendidos</p>
            <a href="#catalog" className="pill-btn mt-4 inline-flex">
              Ver más
            </a>
          </div>
        </div>
        <div className="relative flex min-h-[420px] items-end justify-end bg-neutral-700 p-8 lg:min-h-[520px] lg:p-12">
          <div className="absolute inset-0 bg-gradient-to-bl from-neutral-600 to-neutral-900 opacity-90" />
          <div className="relative text-right text-white">
            <p className="font-display text-3xl italic lg:text-4xl">Looks completos</p>
            <a href="#catalog" className="pill-btn mt-4 inline-flex">
              Ver más
            </a>
          </div>
        </div>
      </section>

      {/* Lo nuevo */}
      {newProducts.length > 0 && (
        <section id="new" className="mx-auto max-w-[1400px] px-4 py-16 lg:px-8">
          <SectionHeader
            title="Lo nuevo"
            viewAllHref="#catalog"
            onPrev={canPrevNew ? () => setNewOffset((o) => Math.max(0, o - 4)) : undefined}
            onNext={canNextNew ? () => setNewOffset((o) => o + 4) : undefined}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleNew.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        </section>
      )}

      {/* Curated drop promo */}
      <section className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 border border-neutral-200 bg-neutral-50 p-8 lg:flex-row lg:items-center lg:p-12">
          <div>
            <Badge>Lanzamiento curado 01</Badge>
            <p className="font-display mt-4 max-w-md text-2xl leading-snug lg:text-3xl">
              Hecho para lo bellamente <em className="italic">inacabado.</em>
            </p>
          </div>
          <a href="#catalog">
            <GlassButton>Explorar la selección</GlassButton>
          </a>
        </div>
      </section>

      {/* Full catalog */}
      <section id="catalog" className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 lg:px-8">
        <SectionHeader title="Todos los productos" viewAllHref="#catalog" />

        {/* Horizontal filters — single row: [search 50%] [gap 5%] [dropdowns+controls ~45%] */}
        <div className="mb-8 border-b border-neutral-200 pb-6">

          {/* Top row: search + sort controls */}
          <div className="flex items-center gap-[5%]">

            {/* Search — 50% */}
            <form onSubmit={submitSearch} className="flex w-[50%] shrink-0 gap-0 border border-neutral-300">
              <GlassInput
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar productos, marcas o SKUs..."
                className="border-0 !py-2 text-xs"
              />
              <GlassButton type="submit" className="shrink-0 rounded-none !py-2 text-xs">
                Buscar
              </GlassButton>
            </form>

            {/* Dropdowns + controls — ~45% */}
            <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
              <select
                value={brand}
                onChange={(event) => { setBrand(event.target.value); setPage(1) }}
                className="glass-input w-auto py-2 text-xs"
              >
                <option value="">Todas las marcas</option>
                {brands.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(event) => { setSort(event.target.value); setPage(1) }}
                className="glass-input w-auto py-2 text-xs"
              >
                <option value="newest">Más recientes</option>
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
                <option value="best_selling">Más vendidos</option>
                <option value="top_rated">Mejor calificados</option>
                <option value="name">Nombre</option>
              </select>
              <label className="flex cursor-pointer items-center gap-2 text-xs uppercase tracking-wider text-neutral-600">
                <input
                  checked={available}
                  onChange={(event) => { setAvailable(event.target.checked); setPage(1) }}
                  type="checkbox"
                  className="accent-black"
                />
                En stock
              </label>
              {(search || category || brand || available) && (
                <button type="button" onClick={resetFilters} className="text-xs uppercase tracking-wider underline underline-offset-4 hover:opacity-70">
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Category pills row */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setCategory(''); setPage(1) }}
              className={`px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wider transition ${
                !category ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
              }`}
            >
              Todas
            </button>
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setCategory(item.slug); setPage(1) }}
                className={`px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wider transition ${
                  category === item.slug ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="aspect-[3/4] animate-pulse bg-neutral-100" />
            ))}
          </div>
        ) : products.length ? (
          <div className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="border border-neutral-200 p-16 text-center text-neutral-500">
            No encontramos productos con esos filtros.
          </div>
        )}

        {pages > 1 && (
          <div className="mt-12 flex justify-center gap-2">
            {Array.from({ length: pages }, (_, index) => index + 1)
              .slice(0, 7)
              .map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={`flex h-10 w-10 items-center justify-center text-sm font-medium transition ${
                    item === page ? 'bg-black text-white' : 'border border-neutral-300 hover:border-black'
                  }`}
                >
                  {item}
                </button>
              ))}
          </div>
        )}
      </section>
    </>
  )
}
