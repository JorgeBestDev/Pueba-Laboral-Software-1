import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { api, friendlyErrorMessage, mediaUrl } from '../../src/api/client'
import type { Address, Order, Wishlist } from '../../src/api/types'
import { useAuth } from '../../src/contexts/auth-context'
import { useToast } from '../../src/contexts/toast-context'
import { PasswordInput } from '../../src/components/PasswordInput'
import { colors } from '../../src/theme'

type AccountTab = 'orders' | 'addresses' | 'wishlist' | 'profile'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  processing: 'Procesando',
  shipped: 'Enviado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export default function AccountScreen() {
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [activeTab, setActiveTab] = useState<AccountTab>('orders')
  const [loadingData, setLoadingData] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [errors, setErrors] = useState<Record<AccountTab, boolean>>({
    orders: false,
    addresses: false,
    wishlist: false,
    profile: false,
  })

  const loadAccountData = async (isRefresh = false) => {
    if (!user) return
    if (isRefresh) setRefreshing(true)
    else setLoadingData(true)

    const results = await Promise.allSettled([
      api.getOrders(),
      api.getAddresses(),
      api.getWishlist(),
    ])

    const [ordersResult, addressesResult, wishlistResult] = results
    setErrors({
      orders: ordersResult.status === 'rejected',
      addresses: addressesResult.status === 'rejected',
      wishlist: wishlistResult.status === 'rejected',
      profile: false,
    })
    if (ordersResult.status === 'fulfilled') setOrders(ordersResult.value)
    if (addressesResult.status === 'fulfilled') setAddresses(addressesResult.value)
    if (wishlistResult.status === 'fulfilled') setWishlist(wishlistResult.value)

    if (isRefresh) setRefreshing(false)
    else setLoadingData(false)
  }

  useEffect(() => {
    setActiveTab('orders')
    void loadAccountData()
  }, [user])

  if (loading) return null
  if (!user) return <View style={styles.guest}><Text style={styles.title}>Tu cuenta, tus piezas favoritas.</Text><Text style={styles.muted}>Inicia sesión para consultar pedidos, direcciones y favoritos.</Text><Pressable onPress={() => router.push('/auth')} style={styles.button}><Text style={styles.buttonText}>Iniciar sesión o crear cuenta</Text></Pressable></View>
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>Cuenta</Text>
        <Text style={styles.title}>Hola, {user.first_name || 'Vokter'}.</Text>
        <Text style={styles.muted}>{user.email}</Text>
      </View>
      <Pressable onPress={() => void logout()} style={styles.logoutTop}>
        <Text style={styles.logoutTopText}>Cerrar sesión</Text>
      </Pressable>
    </View>

    <View style={styles.tabs}>
      {([
        ['orders', 'Pedidos'],
        ['addresses', 'Direcciones'],
        ['wishlist', 'Lista de deseos'],
        ['profile', 'Mi perfil'],
      ] as const).map(([tab, label]) => (
        <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{label}</Text>
        </Pressable>
      ))}
    </View>

    {loadingData ? (
      <Text style={styles.muted}>Cargando información de tu cuenta…</Text>
    ) : (
      <View style={styles.content}>
        {activeTab === 'orders' && <OrdersTab orders={orders} hasError={errors.orders} />}
        {activeTab === 'addresses' && <AddressesTab addresses={addresses} hasError={errors.addresses} />}
        {activeTab === 'wishlist' && <WishlistTab wishlist={wishlist} hasError={errors.wishlist} router={router} />}
        {activeTab === 'profile' && <ProfileTab />}
      </View>
    )}

    <Pressable onPress={() => void loadAccountData(true)} style={styles.refreshButton}>
      <Text style={styles.refreshText}>Actualizar información</Text>
    </Pressable>
  </ScrollView>
}

function ProfileTab() {
  const { user, updateProfile, changePassword } = useAuth()
  const { showToast } = useToast()
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    setFirstName(user?.first_name ?? '')
    setLastName(user?.last_name ?? '')
    setEmail(user?.email ?? '')
  }, [user])

  async function saveProfile() {
    setSavingProfile(true)
    try {
      await updateProfile({ first_name: firstName, last_name: lastName, email })
      showToast('Tus datos personales se guardaron correctamente.', 'success')
    } catch (error) {
      showToast(friendlyErrorMessage(error, 'No se pudo actualizar el perfil.'), 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      showToast('La confirmación debe coincidir con la nueva contraseña.', 'error')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast('Tu contraseña se cambió correctamente.', 'success')
    } catch (error) {
      showToast(friendlyErrorMessage(error, 'No se pudo actualizar la contraseña.'), 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Datos personales</Text>
      <Text style={styles.muted}>Mantén actualizada la información de tu cuenta.</Text>
      <TextInput value={firstName} onChangeText={setFirstName} placeholder="Nombre" style={styles.input} autoCapitalize="words" />
      <TextInput value={lastName} onChangeText={setLastName} placeholder="Apellido" style={styles.input} autoCapitalize="words" />
      <TextInput value={email} onChangeText={setEmail} placeholder="Correo electrónico" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
      <Pressable onPress={() => void saveProfile()} disabled={savingProfile} style={[styles.button, savingProfile && styles.disabledButton]}>
        <Text style={styles.buttonText}>{savingProfile ? 'Guardando…' : 'Guardar cambios'}</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, styles.passwordHeading]}>Cambiar contraseña</Text>
      <Text style={styles.muted}>Confirma tu contraseña actual para proteger tu cuenta.</Text>
      <PasswordInput value={currentPassword} onChangeText={setCurrentPassword} placeholder="Contraseña actual" />
      <PasswordInput value={newPassword} onChangeText={setNewPassword} placeholder="Nueva contraseña" />
      <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirmar nueva contraseña" />
      <Pressable onPress={() => void savePassword()} disabled={savingPassword} style={[styles.secondaryButton, savingPassword && styles.disabledButton]}>
        <Text style={styles.secondaryButtonText}>{savingPassword ? 'Actualizando…' : 'Cambiar contraseña'}</Text>
      </Pressable>
    </View>
  )
}

function OrdersTab({ orders, hasError }: { orders: Order[]; hasError: boolean }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Pedidos recientes</Text>
      {hasError ? <Text style={styles.error}>No pudimos cargar tus pedidos. Inténtalo nuevamente.</Text> : orders.length ? orders.map((order) => (
        <View key={order.id} style={styles.order}>
          <View>
            <Text style={styles.orderTitle}>Pedido #{order.id}</Text>
            <Text style={styles.muted}>{STATUS_LABELS[order.status] ?? order.status}</Text>
          </View>
          <Text style={styles.orderTitle}>${order.total}</Text>
        </View>
      )) : <Text style={styles.muted}>Aún no tienes pedidos.</Text>}
    </View>
  )
}

function AddressesTab({ addresses, hasError }: { addresses: Address[]; hasError: boolean }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Mis direcciones</Text>
      {hasError ? <Text style={styles.error}>No pudimos cargar tus direcciones. Inténtalo nuevamente.</Text> : addresses.length ? addresses.map((address) => (
        <View key={address.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{address.label || 'Dirección'}</Text>
            {address.is_default && <Text style={styles.badge}>Predeterminada</Text>}
          </View>
          <Text style={styles.muted}>{address.street}</Text>
          <Text style={styles.muted}>
            {address.city}{address.state ? `, ${address.state}` : ''}{address.postal_code ? ` · ${address.postal_code}` : ''}
          </Text>
          <Text style={styles.muted}>{address.country}</Text>
        </View>
      )) : <Text style={styles.muted}>No tienes direcciones guardadas. Puedes agregarlas durante el checkout.</Text>}
    </View>
  )
}

function WishlistTab({ wishlist, hasError, router }: { wishlist: Wishlist | null; hasError: boolean; router: ReturnType<typeof useRouter> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Lista de deseos</Text>
      {hasError ? <Text style={styles.error}>No pudimos cargar tu lista de deseos. Inténtalo nuevamente.</Text> : wishlist?.items.length ? wishlist.items.map((item) => (
        <Pressable key={item.id} onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: item.product.slug } })} style={styles.wishlistItem}>
          {mediaUrl(item.product.images?.[0]?.url) ? <Image source={{ uri: mediaUrl(item.product.images?.[0]?.url) }} style={styles.wishlistImage} /> : <View style={styles.wishlistImage} />}
          <View style={styles.wishlistInfo}>
            <Text style={styles.cardTitle}>{item.product.name}</Text>
            <Text style={styles.price}>${item.product.base_price}</Text>
            <Text style={styles.link}>Ver producto</Text>
          </View>
        </Pressable>
      )) : <Text style={styles.muted}>Tu lista de deseos está vacía.</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 10, backgroundColor: colors.white, flexGrow: 1 },
  guest: { flex: 1, padding: 24, justifyContent: 'center', gap: 16, backgroundColor: colors.white },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 26, lineHeight: 32, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 20 },
  button: { backgroundColor: colors.black, padding: 16, marginTop: 8, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  logoutTop: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 9 },
  logoutTopText: { color: colors.ink, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  tabs: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, marginTop: 18 },
  tab: { flex: 1, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  activeTab: { backgroundColor: colors.black },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase' },
  activeTabText: { color: colors.white },
  content: { minHeight: 220 },
  section: { marginTop: 20, borderTopWidth: 1, borderColor: colors.line, paddingTop: 18, gap: 10 },
  sectionTitle: { fontWeight: '800', color: colors.ink, fontSize: 17 },
  order: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, padding: 14 },
  orderTitle: { color: colors.ink, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: colors.line, padding: 14, gap: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  cardTitle: { color: colors.ink, fontWeight: '700', flexShrink: 1 },
  badge: { color: colors.white, backgroundColor: colors.black, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  wishlistItem: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, padding: 10, gap: 12 },
  wishlistImage: { width: 74, height: 74, backgroundColor: colors.surface },
  wishlistInfo: { flex: 1, justifyContent: 'center', gap: 5 },
  price: { color: colors.ink, fontWeight: '700' },
  link: { color: colors.muted, fontSize: 11, textDecorationLine: 'underline' },
  error: { color: colors.danger, lineHeight: 20 },
  refreshButton: { borderWidth: 1, borderColor: colors.line, padding: 13, alignItems: 'center', marginTop: 16 },
  refreshText: { color: colors.ink, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 13, color: colors.ink, backgroundColor: colors.white },
  passwordHeading: { marginTop: 18 },
  secondaryButton: { borderWidth: 1, borderColor: colors.line, padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: colors.ink, fontWeight: '700', textTransform: 'uppercase', fontSize: 11 },
  disabledButton: { opacity: 0.55 },
})
