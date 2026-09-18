import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { friendlyErrorMessage } from '../src/api/client'
import { useAuth } from '../src/contexts/auth-context'
import { PasswordInput } from '../src/components/PasswordInput'
import { useToast } from '../src/contexts/toast-context'
import { colors } from '../src/theme'

export default function AuthScreen() {
  const router = useRouter(); const { login, register } = useAuth(); const { showToast } = useToast()
  const [isRegister, setIsRegister] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState(''); const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!email.trim()) return showToast('Escribe tu correo.', 'error')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return showToast('Escribe un correo válido.', 'error')
    if (!password) return showToast('Escribe tu contraseña.', 'error')
    if (password.length < 8) return showToast('La contraseña debe tener al menos 8 caracteres.', 'error')
    if (isRegister && (!firstName.trim() || !lastName.trim())) return showToast('Escribe tu nombre y apellido.', 'error')
    setSaving(true)
    try {
      if (isRegister) await register({ email: email.trim(), password, first_name: firstName.trim(), last_name: lastName.trim() })
      else await login(email.trim(), password)
      showToast(isRegister ? 'Cuenta creada correctamente.' : 'Sesión iniciada correctamente.', 'success')
      router.back()
    } catch (error) {
      showToast(friendlyErrorMessage(error, 'No fue posible continuar. Revisa los datos e inténtalo nuevamente.'), 'error')
    } finally { setSaving(false) }
  }
  return <View style={styles.page}><Text style={styles.title}>{isRegister ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</Text>{isRegister && <View style={styles.row}><TextInput value={firstName} onChangeText={setFirstName} placeholder="Nombre" style={[styles.input, styles.half]} /><TextInput value={lastName} onChangeText={setLastName} placeholder="Apellido" style={[styles.input, styles.half]} /></View>}<TextInput value={email} onChangeText={setEmail} placeholder="Correo electrónico" autoCapitalize="none" keyboardType="email-address" style={styles.input} /><PasswordInput value={password} onChangeText={setPassword} placeholder="Contraseña" /><Pressable onPress={submit} disabled={saving} style={[styles.button, saving && styles.disabled]}><Text style={styles.buttonText}>{saving ? 'Guardando…' : isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</Text></Pressable>{!isRegister && <Pressable onPress={() => router.push('/forgot-password')}><Text style={styles.link}>Olvidé mi contraseña</Text></Pressable>}<Pressable onPress={() => setIsRegister((value) => !value)}><Text style={styles.link}>{isRegister ? 'Ya tengo una cuenta' : 'Quiero crear una cuenta'}</Text></Pressable></View>
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.white, padding: 22, gap: 12, justifyContent: 'center' }, title: { color: colors.ink, fontSize: 26, fontWeight: '800', marginBottom: 10 }, row: { flexDirection: 'row', gap: 10, width: '100%' }, half: { flex: 1, minWidth: 0 }, input: { borderWidth: 1, borderColor: colors.line, padding: 14, color: colors.ink, minWidth: 0 }, button: { backgroundColor: colors.black, padding: 16, alignItems: 'center', marginTop: 4 }, disabled: { opacity: 0.5 }, buttonText: { color: colors.white, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }, link: { color: colors.ink, textAlign: 'center', padding: 8, fontWeight: '600' } })
