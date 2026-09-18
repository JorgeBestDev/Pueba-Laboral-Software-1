import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ApiError, api, mediaUrl } from '../../src/api/client'
import type { Product } from '../../src/api/types'
import { FavoriteButton } from '../../src/components/FavoriteButton'
import { LoadingView } from '../../src/components/LoadingView'
import { useCart } from '../../src/contexts/cart-context'
import { useToast } from '../../src/contexts/toast-context'
import { useWishlist } from '../../src/contexts/wishlist-context'
import { colors } from '../../src/theme'

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { add } = useCart()
  const { showToast } = useToast()
  const { productIds, busyProductIds, toggle } = useWishlist()
  const [product, setProduct] = useState<Product | null>(null)
  const [variantId, setVariantId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  useEffect(() => { api.getProduct(slug).then((item) => { setProduct(item); setVariantId(item.variants?.find((variant) => variant.is_active && variant.stock_quantity > 0)?.id ?? null) }).catch(() => setProduct(null)) }, [slug])
  if (!product) return <LoadingView />
  const image = mediaUrl(product.images?.[0]?.url)
  const addToCart = async () => {
    if (!variantId) return showToast('Este producto no tiene una variante disponible.', 'error')
    setAdding(true)
    const variant = product.variants?.find((candidate) => candidate.id === variantId)
    try {
      await add(variantId, {
        product_name: product.name,
        variant_name: variant?.name ?? `Variante #${variantId}`,
        product_slug: product.slug,
        image_url: product.images?.[0]?.url ?? null,
        unit_price: variant?.price ?? product.base_price,
        available_variants: product.variants ?? [],
      })
      showToast('Producto añadido al carrito.', 'success')
    }
    catch { showToast('No fue posible añadir el producto. Inténtalo nuevamente.', 'error') }
    finally { setAdding(false) }
  }
  const toggleFavorite = async () => {
    const wasFavorite = productIds.has(product.id)
    try {
      await toggle(product.id)
      showToast(wasFavorite ? 'Eliminado de favoritos.' : '¡Añadido a favoritos!', 'success')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        showToast('Inicia sesión para guardar productos en favoritos.', 'info')
        return
      }
      showToast('No fue posible actualizar favoritos. Inténtalo nuevamente.', 'error')
    }
  }
  return <ScrollView contentContainerStyle={styles.page}>
    {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={styles.image} />}
    <View style={styles.content}>
      <Text style={styles.brand}>{product.brand ?? 'Vokter'}</Text>
      <View style={styles.titleRow}><Text style={styles.title}>{product.name}</Text><FavoriteButton size="large" active={productIds.has(product.id)} loading={busyProductIds.has(product.id)} onPress={toggleFavorite} /></View>
      <Text style={styles.price}>${product.base_price}</Text>
      {product.description && <Text style={styles.description}>{product.description}</Text>}
      <Text style={styles.label}>Elige una variante</Text>
      <View style={styles.variants}>{product.variants?.filter((variant) => variant.is_active).map((variant) => <Pressable key={variant.id} onPress={() => setVariantId(variant.id)} style={[styles.variant, variant.id === variantId && styles.selected, variant.stock_quantity === 0 && styles.unavailable]}><Text style={styles.variantText}>{variant.name} · ${variant.price}</Text></Pressable>)}</View>
      <Pressable disabled={adding || !variantId} onPress={addToCart} style={[styles.primary, (!variantId || adding) && styles.disabled]}><Text style={styles.primaryText}>{adding ? 'Añadiendo…' : 'Añadir al carrito'}</Text></Pressable>
      <Pressable
        onPress={() => router.push({
          pathname: '/(tabs)/assistant',
          params: { initialPrompt: `Dame detalles de el producto '${product.name}'` },
        })}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Preguntar al asistente IA</Text>
      </Pressable>
    </View>
  </ScrollView>
}
const styles = StyleSheet.create({ page: { backgroundColor: colors.white, paddingBottom: 32 }, image: { width: '100%', aspectRatio: 0.85, backgroundColor: colors.surface }, content: { padding: 18, gap: 14 }, brand: { fontSize: 11, color: colors.muted, letterSpacing: 1.5, textTransform: 'uppercase' }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { flex: 1, fontSize: 26, fontWeight: '800', color: colors.ink }, price: { fontSize: 18, fontWeight: '700', color: colors.ink }, description: { color: colors.muted, lineHeight: 22 }, label: { fontWeight: '700', marginTop: 8 }, variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, variant: { borderWidth: 1, borderColor: colors.line, padding: 11 }, selected: { borderColor: colors.black, backgroundColor: colors.surface }, unavailable: { opacity: 0.45 }, variantText: { color: colors.ink, fontSize: 13 }, primary: { backgroundColor: colors.black, padding: 16, alignItems: 'center', marginTop: 8 }, disabled: { opacity: 0.45 }, primaryText: { color: colors.white, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }, secondary: { borderWidth: 1, borderColor: colors.black, padding: 15, alignItems: 'center' }, secondaryText: { color: colors.black, fontWeight: '700' } })
