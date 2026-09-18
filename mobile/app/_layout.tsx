import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../src/contexts/auth-context'
import { CartProvider } from '../src/contexts/cart-context'
import { WishlistProvider } from '../src/contexts/wishlist-context'
import { ToastProvider } from '../src/contexts/toast-context'

export default function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <CartProvider>
          <WishlistProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShadowVisible: false, headerBackTitle: 'Atrás', headerTitleStyle: { fontWeight: '700' } }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="product/[slug]" options={{ title: 'Producto' }} />
              <Stack.Screen name="auth" options={{ title: 'Tu cuenta', presentation: 'modal' }} />
              <Stack.Screen name="forgot-password" options={{ title: 'Recuperar contraseña', presentation: 'modal' }} />
              <Stack.Screen name="reset-password" options={{ title: 'Nueva contraseña', presentation: 'modal' }} />
              <Stack.Screen name="checkout" options={{ title: 'Finalizar compra' }} />
            </Stack>
          </WishlistProvider>
        </CartProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
