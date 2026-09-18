import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Product } from '../api/types'
import { mediaUrl } from '../api/client'
import { FavoriteButton } from './FavoriteButton'
import { colors } from '../theme'

type ProductCardProps = {
  product: Product
  onPress: () => void
  quantity: number
  available: boolean
  onAdd: () => void
  onIncrease: () => void
  onDecrease: () => void
  isFavorite: boolean
  favoriteLoading?: boolean
  onToggleFavorite: () => void
}

export function ProductCard({ product, onPress, quantity, available, onAdd, onIncrease, onDecrease, isFavorite, favoriteLoading, onToggleFavorite }: ProductCardProps) {
  const image = mediaUrl(product.images?.[0]?.url)
  return (
    <View style={styles.card}>
      <View style={styles.favorite}><FavoriteButton active={isFavorite} loading={favoriteLoading} onPress={onToggleFavorite} /></View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Ver ${product.name}`}>
        {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={styles.placeholder} />}
        <Text numberOfLines={1} style={styles.brand}>{product.brand ?? 'Vokter'}</Text>
        <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
      </Pressable>
      <View style={styles.bottomRow}>
        <Text style={styles.price}>${product.base_price}</Text>
        {quantity > 0 ? (
          <View style={styles.stepper} accessibilityLabel={`Cantidad de ${product.name}: ${quantity}`}>
            <Pressable onPress={onDecrease} hitSlop={8} style={styles.stepperButton} accessibilityRole="button" accessibilityLabel={`Quitar una unidad de ${product.name}`}>
              <Text style={styles.stepperSymbol}>−</Text>
            </Pressable>
            <Text style={styles.quantity}>{quantity}</Text>
            <Pressable onPress={onIncrease} hitSlop={8} style={styles.stepperButton} accessibilityRole="button" accessibilityLabel={`Añadir una unidad de ${product.name}`}>
              <Text style={styles.stepperSymbol}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onAdd}
            disabled={!available}
            style={[styles.cartButton, !available && styles.cartButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={available ? `Añadir ${product.name} al carrito` : `${product.name} no está disponible`}
          >
            <Text style={styles.cartIcon}>🛒</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
const styles = StyleSheet.create({
  card: { flex: 1, gap: 5, position: 'relative' }, favorite: { position: 'absolute', top: 8, right: 8, zIndex: 1 }, image: { width: '100%', aspectRatio: 0.78, backgroundColor: colors.surface }, placeholder: { width: '100%', aspectRatio: 0.78, backgroundColor: colors.surface },
  brand: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted, marginTop: 4 }, name: { color: colors.ink, fontWeight: '600', minHeight: 36 },
  bottomRow: { minHeight: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }, price: { color: colors.ink, fontWeight: '700' },
  cartButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black }, cartButtonDisabled: { opacity: 0.32 }, cartIcon: { fontSize: 17 },
  stepper: { height: 36, minWidth: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.black }, stepperButton: { width: 29, height: '100%', alignItems: 'center', justifyContent: 'center' }, stepperSymbol: { color: colors.ink, fontSize: 19, lineHeight: 21 }, quantity: { color: colors.ink, fontWeight: '700', minWidth: 16, textAlign: 'center' },
})
