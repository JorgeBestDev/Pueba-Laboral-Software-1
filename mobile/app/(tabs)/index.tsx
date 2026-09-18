import { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import type { Category, Product } from '../../src/api/types'
import { LoadingView } from '../../src/components/LoadingView'
import { ProductCard } from '../../src/components/ProductCard'
import { useCart } from '../../src/contexts/cart-context'
import { colors } from '../../src/theme'

export default function CatalogScreen() {
  const router = useRouter()
  const { cart, add, update, remove } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (search = query, nextCategory = category, nextSort = sort) => {
    try { setError(null); setProducts(await api.getProducts({ search, category: nextCategory || undefined, sort: nextSort })) }
    catch { setError('No pudimos cargar el catálogo. Revisa la conexión con la API.') }
  }, [query, category, sort])
  useEffect(() => {
    Promise.all([
      api.getProducts({ sort: 'newest' }).then(setProducts),
      api.getCategories().then(setCategories),
    ]).catch(() => undefined).finally(() => setLoading(false))
  }, [])
  const selectCategory = (slug: string) => { setCategory(slug); load(query, slug, sort) }
  const selectSort = (nextSort: string) => { setSort(nextSort); load(query, category, nextSort) }
  if (loading) return <LoadingView />
  return (
    <FlatList
      data={products}
      keyExtractor={(product) => String(product.id)}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)) }} />}
      ListHeaderComponent={<View style={styles.header}>
        <Text style={styles.eyebrow}>Vokter</Text>
        <Text style={styles.title}>Encuentra piezas con intención.</Text>
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => load()} placeholder="Buscar productos o marcas" returnKeyType="search" style={styles.search} />
        <Text style={styles.filterLabel}>Categorías</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><FilterChip label="Todas" active={!category} onPress={() => selectCategory('')} />{categories.map((item) => <FilterChip key={item.id} label={item.name} active={category === item.slug} onPress={() => selectCategory(item.slug)} />)}</ScrollView>
        <Text style={styles.filterLabel}>Ordenar y filtrar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{SORT_OPTIONS.map((option) => <FilterChip key={option.value} label={option.label} active={sort === option.value} onPress={() => selectSort(option.value)} />)}</ScrollView>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>}
      ListEmptyComponent={<Text style={styles.empty}>No encontramos productos con esa búsqueda.</Text>}
      renderItem={({ item }) => {
        const variant = item.variants?.find((candidate) => candidate.is_active && candidate.stock_quantity > 0)
        const cartItem = variant ? cart?.items.find((candidate) => candidate.variant_id === variant.id) : undefined
        const quantity = cartItem?.quantity ?? 0
        const runCartAction = async (action: () => Promise<void>) => {
          try { await action() }
          catch { Alert.alert('No fue posible actualizar el carrito', 'Inténtalo nuevamente.') }
        }
        return <ProductCard
          product={item}
          onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: item.slug } })}
          quantity={quantity}
          available={Boolean(variant)}
          onAdd={() => variant && runCartAction(() => add(variant.id))}
          onIncrease={() => variant && runCartAction(() => add(variant.id))}
          onDecrease={() => cartItem && runCartAction(() => cartItem.quantity === 1 ? remove(cartItem.id) : update(cartItem.id, cartItem.quantity - 1))}
        />
      }}
    />
  )
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'top_rated', label: 'Reseñas: mayor a menor' },
  { value: 'rating_asc', label: 'Reseñas: menor a mayor' },
  { value: 'name', label: 'Nombre: A a Z' },
  { value: 'name_desc', label: 'Nombre: Z a A' },
]

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 16, backgroundColor: colors.white }, row: { gap: 14 }, header: { gap: 10, paddingBottom: 6 }, eyebrow: { color: colors.accent, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }, title: { color: colors.ink, fontSize: 27, fontWeight: '800', lineHeight: 32, maxWidth: 300 },
  search: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, marginTop: 6 }, filterLabel: { color: colors.ink, fontWeight: '700', fontSize: 13, marginTop: 4 }, chips: { gap: 8, paddingRight: 8 }, chip: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 9 }, chipActive: { backgroundColor: colors.black, borderColor: colors.black }, chipText: { color: colors.ink, fontSize: 12, fontWeight: '600' }, chipTextActive: { color: colors.white }, error: { color: colors.danger, fontSize: 13 }, empty: { color: colors.muted, paddingVertical: 30, textAlign: 'center' },
})
