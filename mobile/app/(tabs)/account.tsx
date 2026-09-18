import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import type { Order } from '../../src/api/types'
import { useAuth } from '../../src/contexts/auth-context'
import { colors } from '../../src/theme'

export default function AccountScreen() {
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  useEffect(() => { if (user) api.getOrders().then(setOrders).catch(() => undefined) }, [user])
  if (loading) return null
  if (!user) return <View style={styles.guest}><Text style={styles.title}>Tu cuenta, tus piezas favoritas.</Text><Text style={styles.muted}>Inicia sesión para consultar pedidos, direcciones y favoritos.</Text><Pressable onPress={() => router.push('/auth')} style={styles.button}><Text style={styles.buttonText}>Iniciar sesión o crear cuenta</Text></Pressable></View>
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.eyebrow}>Cuenta</Text><Text style={styles.title}>Hola, {user.first_name || 'Vokter'}.</Text><Text style={styles.muted}>{user.email}</Text>
    <View style={styles.section}><Text style={styles.sectionTitle}>Pedidos recientes</Text>{orders.length ? orders.map((order) => <View key={order.id} style={styles.order}><View><Text style={styles.orderTitle}>Pedido #{order.id}</Text><Text style={styles.muted}>{order.status}</Text></View><Text style={styles.orderTitle}>${order.total}</Text></View>) : <Text style={styles.muted}>Aún no tienes pedidos.</Text>}</View>
    <Pressable onPress={() => logout()} style={styles.logout}><Text style={styles.logoutText}>Cerrar sesión</Text></Pressable>
  </ScrollView>
}
const styles = StyleSheet.create({ page: { padding: 18, gap: 10, backgroundColor: colors.white, flexGrow: 1 }, guest: { flex: 1, padding: 24, justifyContent: 'center', gap: 16, backgroundColor: colors.white }, eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }, title: { color: colors.ink, fontSize: 26, lineHeight: 32, fontWeight: '800' }, muted: { color: colors.muted, lineHeight: 20 }, button: { backgroundColor: colors.black, padding: 16, marginTop: 8, alignItems: 'center' }, buttonText: { color: colors.white, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }, section: { marginTop: 20, borderTopWidth: 1, borderColor: colors.line, paddingTop: 18, gap: 10 }, sectionTitle: { fontWeight: '800', color: colors.ink, fontSize: 17 }, order: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, padding: 14 }, orderTitle: { color: colors.ink, fontWeight: '700' }, logout: { marginTop: 14, padding: 15, borderWidth: 1, borderColor: colors.danger, alignItems: 'center' }, logoutText: { color: colors.danger, fontWeight: '700' } })
