import { Tabs } from 'expo-router'

export default function TabLayout() {
  return <Tabs screenOptions={{ headerTitleStyle: { fontWeight: '800' }, tabBarActiveTintColor: '#080808' }}>
    <Tabs.Screen name="index" options={{ title: 'Explorar', tabBarLabel: 'Explorar' }} />
    <Tabs.Screen name="cart" options={{ title: 'Carrito', tabBarLabel: 'Carrito' }} />
    <Tabs.Screen name="assistant" options={{ title: 'Asistente IA', tabBarLabel: 'Asistente' }} />
    <Tabs.Screen name="account" options={{ title: 'Cuenta', tabBarLabel: 'Cuenta' }} />
  </Tabs>
}
