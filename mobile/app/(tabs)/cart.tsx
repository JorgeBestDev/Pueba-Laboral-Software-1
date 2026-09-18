import { useState } from 'react'
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useCart } from '../../src/contexts/cart-context'
import { useToast } from '../../src/contexts/toast-context'
import { mediaUrl } from '../../src/api/client'
import { LoadingView } from '../../src/components/LoadingView'
import { colors } from '../../src/theme'

export default function CartScreen() {
  const router = useRouter()
  const { cart, loading, update, remove, replaceVariant } = useCart()
  const { showToast } = useToast()
  if (loading) return <LoadingView />
  const items = cart?.items ?? []
  return <View style={styles.page}>
    <FlatList data={items} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>Tu carrito está vacío.</Text>} renderItem={({ item }) => <View style={styles.item}>
      {item.image_url ? <Image source={{ uri: mediaUrl(item.image_url) }} style={styles.image} /> : <View style={styles.imagePlaceholder} />}
      <View style={styles.itemInfo}><Text numberOfLines={2} style={styles.productName}>{item.product_name}</Text><VariantPicker currentId={item.variant_id} currentName={item.variant_name} variants={item.available_variants} onSelect={(variantId) => replaceVariant(item.id, variantId).catch(() => showToast('No fue posible cambiar la variante. La opción seleccionada no tiene suficiente disponibilidad.', 'error'))} /><Text style={styles.muted}>${item.unit_price ?? '0.00'} c/u</Text><View style={styles.quantity}><Pressable onPress={() => update(item.id, Math.max(1, item.quantity - 1))}><Text style={styles.control}>−</Text></Pressable><Text>{item.quantity}</Text><Pressable onPress={() => update(item.id, item.quantity + 1)}><Text style={styles.control}>+</Text></Pressable></View></View>
      <View style={{ alignItems: 'flex-end', gap: 12 }}><Text style={styles.total}>${((Number(item.unit_price) || 0) * item.quantity).toFixed(2)}</Text><Pressable onPress={() => remove(item.id)}><Text style={styles.remove}>Eliminar</Text></Pressable></View>
    </View>} />
    {items.length > 0 && <View style={styles.footer}><View style={styles.summary}><Text style={styles.total}>Subtotal</Text><Text style={styles.total}>${cart?.total}</Text></View><Pressable onPress={() => router.push('/checkout')} style={styles.checkout}><Text style={styles.checkoutText}>Ir a pagar</Text></Pressable></View>}
  </View>
}

function VariantPicker({ currentId, currentName, variants, onSelect }: { currentId: number; currentName: string; variants: { id: number; name: string; price: string; stock_quantity: number }[]; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  if (variants.length <= 1) return <Text style={styles.variant}>{currentName}</Text>
  return <View style={styles.variantPicker}><Pressable onPress={() => setOpen((value) => !value)} style={styles.variantTrigger} accessibilityRole="button" accessibilityLabel="Cambiar variante"><Text numberOfLines={1} style={styles.variant}>{currentName}</Text><Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text></Pressable>{open && <View style={styles.variantOptions}>{variants.map((variant) => <Pressable key={variant.id} onPress={() => { if (variant.id !== currentId) onSelect(variant.id); setOpen(false) }} style={[styles.variantOption, variant.id === currentId && styles.selectedVariant]}><Text style={styles.variantOptionText}>{variant.name}</Text><Text style={styles.variantPrice}>${variant.price}</Text></Pressable>)}</View>}</View>
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.white }, list: { padding: 16, gap: 12, flexGrow: 1 }, item: { borderWidth: 1, borderColor: colors.line, padding: 12, flexDirection: 'row', gap: 12 }, image: { width: 78, height: 96, backgroundColor: colors.surface }, imagePlaceholder: { width: 78, height: 96, backgroundColor: colors.surface }, itemInfo: { flex: 1, minWidth: 0 }, productName: { color: colors.ink, fontWeight: '700', fontSize: 15 }, variant: { color: colors.muted, fontSize: 13, marginTop: 3, flex: 1 }, variantPicker: { marginTop: 2 }, variantTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6 }, chevron: { color: colors.ink, fontSize: 15 }, variantOptions: { marginTop: 6, borderWidth: 1, borderColor: colors.line }, variantOption: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 9 }, selectedVariant: { backgroundColor: colors.surface }, variantOptionText: { color: colors.ink, fontSize: 13, flex: 1 }, variantPrice: { color: colors.muted, fontSize: 12 }, muted: { color: colors.muted, fontSize: 13, marginTop: 4 }, quantity: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 }, control: { fontSize: 22, minWidth: 22, textAlign: 'center' }, total: { color: colors.ink, fontWeight: '800', fontSize: 16 }, remove: { color: colors.danger, fontSize: 12, fontWeight: '700' }, empty: { color: colors.muted, textAlign: 'center', paddingTop: 48 }, footer: { padding: 16, borderTopWidth: 1, borderColor: colors.line, gap: 14 }, summary: { flexDirection: 'row', justifyContent: 'space-between' }, checkout: { backgroundColor: colors.black, padding: 16, alignItems: 'center' }, checkoutText: { color: colors.white, textTransform: 'uppercase', fontWeight: '800', letterSpacing: 1 } })
