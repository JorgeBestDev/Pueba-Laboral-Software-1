import { expect, test } from '@playwright/test'

const product = {
  id: 1,
  name: 'Tenis Vokter',
  slug: 'tenis-vokter',
  description: 'Un producto de prueba.',
  brand: 'Vokter',
  base_price: '120.00',
  is_active: true,
  is_featured: true,
  categories: [{ id: 1, name: 'Calzado', slug: 'calzado' }],
  reviews: { count: 4, average: 4.5 },
  images: [],
  variants: [{ id: 1, sku: 'VOK-001', name: 'Única', price: '120.00', stock_quantity: 5, is_active: true }],
}

test('el catálogo carga, busca y cambia de orden sin depender de la API real', async ({ page }) => {
  const catalogRequests: URL[] = []

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/catalog/products')) {
      catalogRequests.push(url)
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [product], meta: { page: 1, per_page: 20, total: 1, pages: 1 } }),
      })
      return
    }
    if (url.pathname.endsWith('/catalog/categories')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: product.categories }) })
      return
    }
    if (url.pathname.endsWith('/catalog/filters')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { brands: ['Vokter'], price: { min: '120.00', max: '120.00' } } }),
      })
      return
    }
    if (url.pathname.endsWith('/carts')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 1, user_id: null, session_key: 'e2e-session', status: 'active', items: [], total: '0.00' },
        }),
      })
      return
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) })
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Objetos curados para tu próximo capítulo.' })).toBeVisible()
  await expect(page.getByText('Tenis Vokter').first()).toBeVisible()

  const catalog = page.locator('#catalog')
  await catalog.getByPlaceholder('Buscar productos, marcas o SKUs...').fill('Tenis')
  await catalog.getByRole('button', { name: 'Buscar' }).click()
  await expect.poll(() => catalogRequests.some((url) => url.searchParams.get('q') === 'Tenis')).toBe(true)

  await catalog.locator('select').nth(1).selectOption('price_desc')
  await expect.poll(() => catalogRequests.some((url) => url.searchParams.get('sort') === 'price_desc')).toBe(true)
})
