import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ApiError, api } from '../src/api/client'
import { useToast } from '../src/contexts/toast-context'
import { colors } from '../src/theme'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const { showToast } = useToast()

  async function submit() {
    if (!email.trim()) {
      showToast('Escribe el correo asociado a tu cuenta.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const response = await api.requestPasswordReset(email.trim())
      setSent(true)
      showToast(response.message, 'success')
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'No se pudo enviar la solicitud.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Recuperar contraseña</Text>
      <Text style={styles.muted}>Escribe tu correo y revisa tu bandeja de entrada para continuar.</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Correo electrónico" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <Pressable onPress={() => void submit()} disabled={submitting || sent} style={[styles.button, (submitting || sent) && styles.disabled]}>
        <Text style={styles.buttonText}>{submitting ? 'Enviando…' : sent ? 'Correo enviado' : 'Enviar enlace'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}><Text style={styles.link}>Volver a iniciar sesión</Text></Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.white, padding: 22, gap: 14, justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  muted: { color: colors.muted, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: colors.line, padding: 14, color: colors.ink },
  button: { backgroundColor: colors.black, padding: 16, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  link: { color: colors.ink, textAlign: 'center', padding: 8, fontWeight: '600' },
})
