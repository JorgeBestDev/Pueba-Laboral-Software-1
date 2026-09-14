import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import * as adminApi from '../lib/admin-api'
import { Modal } from '../components/ui'
import { AdminBadge, AdminEmptyState, AdminPagination } from './AdminUI'

type ProductFormState = {
  name: string
  slug: string
  description: string
  brand: string
  base_price: string
  is_active: boolean
  is_featured: boolean
  category_ids: number[]
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: '',
  slug: '',
  description: '',
  brand: '',
  base_price: '',
  is_active: true,
  is_featured: false,
  category_ids: [],
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Returns the full URL for an image path returned by the backend (/uploads/...). */
function imageUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1')
    .replace(/\/api\/v1\/?$/, '')
  return path.startsWith('http') ? path : `${base}${path}`
}

export function AdminProductsPage() {
  const [tab, setTab] = useState<'products' | 'categories'>('products')

  const [products, setProducts] = useState<adminApi.AdminProduct[]>([])
  const [meta, setMeta] = useState<{ page: number; pages: number } | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<adminApi.AdminCategory[]>([])

  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM)
  const [variants, setVariants] = useState<adminApi.AdminVariant[]>([])
  const [saving, setSaving] = useState(false)

  // ── image state ──────────────────────────────────────────────────────────
  const [images, setImages] = useState<adminApi.AdminProductImage[]>([])
  // Pending file selected but not yet uploaded (only used during "create" flow)
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // ─────────────────────────────────────────────────────────────────────────

  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '' })
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)

  const loadCategories = () => adminApi.listAdminCategories().then(setCategories).catch(() => setCategories([]))

  const loadProducts = () => {
    setLoading(true)
    adminApi
      .listAdminProducts({ page, q: search || undefined })
      .then((response) => {
        setProducts(response.data)
        setMeta({ page: response.meta.page, pages: response.meta.pages })
        setError(null)
      })
      .catch((err) => setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudieron cargar los productos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Clean up blob URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
    }
  }, [pendingImage])

  const openCreateProduct = () => {
    setEditingProductId(null)
    setForm(EMPTY_PRODUCT_FORM)
    setVariants([])
    setImages([])
    setPendingImage(null)
    setProductModalOpen(true)
  }

  const openEditProduct = async (id: number) => {
    try {
      const product = await adminApi.getAdminProduct(id)
      setEditingProductId(product.id)
      setForm({
        name: product.name,
        slug: product.slug,
        description: product.description ?? '',
        brand: product.brand ?? '',
        base_price: product.base_price,
        is_active: product.is_active,
        is_featured: product.is_featured,
        category_ids: product.categories.map((category) => category.id),
      })
      setVariants(product.variants ?? [])
      setImages(product.images ?? [])
      setPendingImage(null)
      setProductModalOpen(true)
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo cargar el producto')
    }
  }

  const handleProductSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description || undefined,
        brand: form.brand || undefined,
        base_price: form.base_price,
        is_active: form.is_active,
        is_featured: form.is_featured,
        category_ids: form.category_ids,
      }
      if (editingProductId) {
        await adminApi.updateAdminProduct(editingProductId, payload)
      } else {
        // Create the product first, then upload the pending image if any
        const created = await adminApi.createAdminProduct(payload)
        if (pendingImage) {
          try {
            await adminApi.uploadAdminProductImage(created.id, pendingImage.file)
          } catch {
            // Image upload failure is non-fatal: the product was already saved
            setError('Producto creado, pero no se pudo subir la imagen.')
          }
        }
      }
      setProductModalOpen(false)
      loadProducts()
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo guardar el producto')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('¿Desactivar este producto? Dejará de mostrarse en la tienda.')) return
    try {
      await adminApi.deleteAdminProduct(id)
      loadProducts()
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo desactivar el producto')
    }
  }

  const toggleCategory = (id: number) => {
    setForm((current) => ({
      ...current,
      category_ids: current.category_ids.includes(id)
        ? current.category_ids.filter((value) => value !== id)
        : [...current.category_ids, id],
    }))
  }

  // ── image handlers ────────────────────────────────────────────────────────

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (editingProductId) {
      // Edit mode: upload immediately and add to the images list
      setUploadingImage(true)
      try {
        const uploaded = await adminApi.uploadAdminProductImage(editingProductId, file)
        setImages((current) => [...current, uploaded])
      } catch (err) {
        setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo subir la imagen')
      } finally {
        setUploadingImage(false)
      }
    } else {
      // Create mode: just show a local preview; upload happens after product creation
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
      setPendingImage({ file, previewUrl: URL.createObjectURL(file) })
    }
  }

  const handleDeleteImage = async (imageId: number) => {
    try {
      await adminApi.deleteAdminProductImage(imageId)
      setImages((current) => current.filter((img) => img.id !== imageId))
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo eliminar la imagen')
    }
  }

  const handleClearPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  const [variantForm, setVariantForm] = useState({ sku: '', name: '', price: '', stock_quantity: '0' })

  const handleAddVariant = async () => {
    if (!editingProductId) return
    if (!variantForm.sku || !variantForm.name || !variantForm.price) return
    try {
      const variant = await adminApi.createAdminVariant(editingProductId, {
        sku: variantForm.sku,
        name: variantForm.name,
        price: variantForm.price,
        stock_quantity: Number(variantForm.stock_quantity) || 0,
      })
      setVariants((current) => [...current, variant])
      setVariantForm({ sku: '', name: '', price: '', stock_quantity: '0' })
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo crear la variante')
    }
  }

  const handleVariantStockChange = async (variantId: number, stock: number) => {
    try {
      const updated = await adminApi.updateAdminVariant(variantId, { stock_quantity: stock })
      setVariants((current) => current.map((item) => (item.id === variantId ? updated : item)))
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo actualizar el stock')
    }
  }

  const handleVariantToggle = async (variantId: number, isActive: boolean) => {
    try {
      const updated = await adminApi.updateAdminVariant(variantId, { is_active: isActive })
      setVariants((current) => current.map((item) => (item.id === variantId ? updated : item)))
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo actualizar la variante')
    }
  }

  const handleCategorySubmit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const payload = { name: categoryForm.name, slug: categoryForm.slug || slugify(categoryForm.name), description: categoryForm.description || undefined }
      if (editingCategoryId) {
        await adminApi.updateAdminCategory(editingCategoryId, payload)
      } else {
        await adminApi.createAdminCategory(payload)
      }
      setCategoryForm({ name: '', slug: '', description: '' })
      setEditingCategoryId(null)
      loadCategories()
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo guardar la categoría')
    }
  }

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('¿Desactivar esta categoría?')) return
    try {
      await adminApi.deleteAdminCategory(id)
      loadCategories()
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo desactivar la categoría')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setTab('products')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest ${tab === 'products' ? 'border-b-2 border-black text-black' : 'text-neutral-400'}`}
        >
          Productos
        </button>
        <button
          type="button"
          onClick={() => setTab('categories')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest ${tab === 'categories' ? 'border-b-2 border-black text-black' : 'text-neutral-400'}`}
        >
          Categorías
        </button>
      </div>

      {error && <p className="border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {tab === 'products' ? (
        <div className="space-y-4">
          <div className="glass-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setPage(1)
                    loadProducts()
                  }
                }}
                placeholder="Buscar productos…"
                className="glass-input sm:max-w-xs"
              />
              <button
                type="button"
                onClick={() => {
                  setPage(1)
                  loadProducts()
                }}
                className="glass-button !bg-black !text-white"
              >
                Buscar
              </button>
            </div>
            <button type="button" onClick={openCreateProduct} className="glass-button !bg-black !text-white">
              + Nuevo producto
            </button>
          </div>

          <div className="glass-panel overflow-hidden">
            {loading ? (
              <AdminEmptyState message="Cargando productos…" />
            ) : products.length === 0 ? (
              <AdminEmptyState message="No hay productos que coincidan con la búsqueda." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-[0.65rem] uppercase tracking-widest text-neutral-500">
                      <th className="px-4 py-3 font-medium">Producto</th>
                      <th className="px-4 py-3 font-medium">Categorías</th>
                      <th className="px-4 py-3 font-medium">Precio base</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <span className="font-medium">{product.name}</span>
                          {product.is_featured && <span className="ml-2 text-xs text-amber-600">★ Destacado</span>}
                          <span className="block text-xs text-neutral-500">{product.brand}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">
                          {product.categories.map((category) => category.name).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">${Number(product.base_price).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <AdminBadge tone={product.is_active ? 'success' : 'danger'}>
                            {product.is_active ? 'Activo' : 'Inactivo'}
                          </AdminBadge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEditProduct(product.id)}
                            className="mr-3 text-xs font-semibold uppercase tracking-widest underline underline-offset-4"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-xs font-semibold uppercase tracking-widest text-red-600 underline underline-offset-4"
                          >
                            Desactivar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {meta && <AdminPagination page={meta.page} pages={meta.pages} onChange={setPage} />}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form onSubmit={handleCategorySubmit} className="glass-panel space-y-3 p-5 lg:col-span-1">
            <h3 className="font-display text-sm uppercase tracking-widest text-neutral-500">
              {editingCategoryId ? 'Editar categoría' : 'Nueva categoría'}
            </h3>
            <input
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nombre"
              required
              className="glass-input"
            />
            <input
              value={categoryForm.slug}
              onChange={(event) => setCategoryForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="Slug (opcional)"
              className="glass-input"
            />
            <textarea
              value={categoryForm.description}
              onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Descripción"
              className="glass-input"
              rows={3}
            />
            <div className="flex gap-2">
              <button type="submit" className="glass-button flex-1 !bg-black !text-white">
                {editingCategoryId ? 'Guardar' : 'Crear'}
              </button>
              {editingCategoryId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategoryId(null)
                    setCategoryForm({ name: '', slug: '', description: '' })
                  }}
                  className="glass-button flex-1 !border !border-neutral-300 !bg-white !text-black"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="glass-panel overflow-hidden lg:col-span-2">
            {categories.length === 0 ? (
              <AdminEmptyState message="Aún no hay categorías." />
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-[0.65rem] uppercase tracking-widest text-neutral-500">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Slug</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3 font-medium">{category.name}</td>
                      <td className="px-4 py-3 text-neutral-500">{category.slug}</td>
                      <td className="px-4 py-3">
                        <AdminBadge tone={category.is_active ? 'success' : 'danger'}>
                          {category.is_active ? 'Activa' : 'Inactiva'}
                        </AdminBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(category.id)
                            setCategoryForm({ name: category.name, slug: category.slug, description: category.description ?? '' })
                          }}
                          className="mr-3 text-xs font-semibold uppercase tracking-widest underline underline-offset-4"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category.id)}
                          className="text-xs font-semibold uppercase tracking-widest text-red-600 underline underline-offset-4"
                        >
                          Desactivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <Modal open={productModalOpen} onClose={() => setProductModalOpen(false)} className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">{editingProductId ? 'Editar producto' : 'Nuevo producto'}</h3>
          <button
            type="button"
            onClick={() => setProductModalOpen(false)}
            className="text-xs uppercase tracking-widest text-neutral-500 hover:text-black"
          >
            Cerrar ✕
          </button>
        </div>

        <form onSubmit={handleProductSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nombre"
              required
              className="glass-input"
            />
            <input
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="Slug (opcional)"
              className="glass-input"
            />
            <input
              value={form.brand}
              onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
              placeholder="Marca"
              className="glass-input"
            />
            <input
              value={form.base_price}
              onChange={(event) => setForm((current) => ({ ...current, base_price: event.target.value }))}
              placeholder="Precio base"
              type="number"
              step="0.01"
              min="0"
              required
              className="glass-input"
            />
          </div>
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Descripción"
            className="glass-input"
            rows={3}
          />

          {/* ── Image upload section ──────────────────────────────────────── */}
          <div className="border-t border-neutral-200 pt-3">
            <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">
              Fotos del producto
            </p>

            {/* Saved images (edit mode) */}
            {images.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-3">
                {images.map((img) => (
                  <div key={img.id} className="group relative h-24 w-24 shrink-0 overflow-hidden border border-neutral-200 bg-neutral-50">
                    <img
                      src={imageUrl(img.url)}
                      alt={img.alt_text ?? ''}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      aria-label="Eliminar imagen"
                      className="absolute right-0 top-0 bg-black/70 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending preview (create mode — shown before form is submitted) */}
            {pendingImage && !editingProductId && (
              <div className="mb-3 flex items-start gap-3">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden border border-neutral-200 bg-neutral-50">
                  <img
                    src={pendingImage.previewUrl}
                    alt="Vista previa"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-1 pt-1">
                  <p className="text-xs text-neutral-500 max-w-[14rem] truncate">{pendingImage.file.name}</p>
                  <p className="text-[0.65rem] text-neutral-400">
                    La imagen se subirá al guardar el producto.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearPendingImage}
                    className="text-xs font-semibold text-red-600 underline underline-offset-2 self-start"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}

            {/* Upload button */}
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Subir foto del producto"
              />
              <button
                type="button"
                disabled={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="glass-button !border !border-neutral-300 !bg-white !text-black text-xs"
              >
                {uploadingImage ? 'Subiendo…' : '+ Subir foto'}
              </button>
              <span className="text-[0.65rem] text-neutral-400">
                JPEG, PNG, WebP o GIF · máx. 8 MB
                {editingProductId
                  ? ' · se sube de inmediato'
                  : ' · se sube al guardar'}
              </span>
            </div>
          </div>
          {/* ─────────────────────────────────────────────────────────────── */}

          <div>
            <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">Categorías</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className={`cursor-pointer border px-3 py-1 text-xs ${
                    form.category_ids.includes(category.id) ? 'border-black bg-black text-white' : 'border-neutral-300 text-neutral-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={form.category_ids.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
              />
              Activo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(event) => setForm((current) => ({ ...current, is_featured: event.target.checked }))}
              />
              Destacado
            </label>
          </div>

          {editingProductId && (
            <div className="border-t border-neutral-200 pt-4">
              <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">Variantes</p>
              <div className="space-y-2">
                {variants.map((variant) => (
                  <div key={variant.id} className="flex flex-wrap items-center gap-2 border border-neutral-200 px-3 py-2 text-sm">
                    <span className="flex-1 font-medium">
                      {variant.name} <span className="text-neutral-400">({variant.sku})</span>
                    </span>
                    <span>${Number(variant.price).toFixed(2)}</span>
                    <input
                      type="number"
                      min="0"
                      defaultValue={variant.stock_quantity}
                      onBlur={(event) => handleVariantStockChange(variant.id, Number(event.target.value) || 0)}
                      className="glass-input w-20 !py-1"
                    />
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={variant.is_active}
                        onChange={(event) => handleVariantToggle(variant.id, event.target.checked)}
                      />
                      Activa
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input
                  value={variantForm.sku}
                  onChange={(event) => setVariantForm((current) => ({ ...current, sku: event.target.value }))}
                  placeholder="SKU"
                  className="glass-input !py-1"
                />
                <input
                  value={variantForm.name}
                  onChange={(event) => setVariantForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nombre"
                  className="glass-input !py-1"
                />
                <input
                  value={variantForm.price}
                  onChange={(event) => setVariantForm((current) => ({ ...current, price: event.target.value }))}
                  placeholder="Precio"
                  type="number"
                  step="0.01"
                  className="glass-input !py-1"
                />
                <button type="button" onClick={handleAddVariant} className="glass-button !bg-black !text-white !py-1">
                  + Añadir
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setProductModalOpen(false)}
              className="glass-button !border !border-neutral-300 !bg-white !text-black"
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="glass-button !bg-black !text-white">
              {saving ? 'Guardando…' : 'Guardar producto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

