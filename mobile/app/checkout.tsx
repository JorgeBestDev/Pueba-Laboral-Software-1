import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { api } from '../src/api/client'
import { useAuth } from '../src/contexts/auth-context'
import { useCart } from '../src/contexts/cart-context'
import { colors } from '../src/theme'

export default function CheckoutScreen() {
  const router = useRouter(); const { user } = useAuth(); const { cart, refresh } = useCart()
  const [address, setAddress] = useState(''); const [payment, setPayment] = useState<'card' | 'paypal' | 'cash_on_delivery'>('card'); const [saving, setSaving] = useState(false)
  const complete = async () => {
    if (!user) return router.push('/auth')
    if (!cart?.items.length) return router.back()
    if (!address.trim()) return Alert.alert('Falta la dirección', 'Escribe la dirección de entrega.')
    setSaving(true)
    try { const order = await api.checkout({ cart_id: cart.id, shipping_address: address.trim(), payment_method: payment, idempotencyKey: `mobile-${Date.now()}` }); await refresh(); Alert.alert('Pedido creado', `Tu pedido #${order.id} fue creado correctamente.`); router.replace('/(tabs)/account') }
    catch { Alert.alert('No fue posible completar el pedido', 'Revisa la información e inténtalo nuevamente.') }
    finally { setSaving(false) }
  }
  return <View style={styles.page}><Text style={styles.title}>Resumen</Text><Text style={styles.total}>Total: ${cart?.total ?? '0.00'}</Text>{!user && <Text style={styles.notice}>Inicia sesión para finalizar la compra.</Text>}<Text style={styles.label}>Dirección de entrega</Text><TextInput value={address} onChangeText={setAddress} placeholder="Calle, ciudad y país" multiline style={styles.input} /><Text style={styles.label}>Método de pago</Text><View style={styles.methods}>{(['card', 'paypal', 'cash_on_delivery'] as const).map((method) => <Pressable key={method} onPress={() => setPayment(method)} style={[styles.method, payment === method && styles.selected]}><Text style={styles.methodText}>{method === 'card' ? 'Tarjeta' : method === 'paypal' ? 'PayPal' : 'Contraentrega'}</Text></Pressable>)}</View><Pressable onPress={complete} disabled={saving} style={[styles.button, saving && styles.disabled]}><Text style={styles.buttonText}>{!user ? 'Iniciar sesión' : saving ? 'Procesando…' : 'Confirmar pedido'}</Text></Pressable></View>
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 18, gap: 12, backgroundColor: colors.white }, title: { color: colors.ink, fontSize: 24, fontWeight: '800' }, total: { color: colors.ink, fontSize: 18, fontWeight: '700' }, notice: { backgroundColor: colors.surface, padding: 12, color: colors.muted }, label: { color: colors.ink, fontWeight: '700', marginTop: 8 }, input: { minHeight: 84, borderWidth: 1, borderColor: colors.line, padding: 12, textAlignVertical: 'top' }, methods: { gap: 8 }, method: { borderWidth: 1, borderColor: colors.line, padding: 13 }, selected: { borderColor: colors.black, backgroundColor: colors.surface }, methodText: { color: colors.ink, fontWeight: '600' }, button: { marginTop: 10, backgroundColor: colors.black, alignItems: 'center', padding: 16 }, disabled: { opacity: 0.5 }, buttonText: { color: colors.white, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 } })
