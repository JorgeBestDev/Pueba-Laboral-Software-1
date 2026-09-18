import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api, friendlyErrorMessage } from '../src/api/client'
import { colors } from '../src/theme'
import { PasswordInput } from '../src/components/PasswordInput'
import { useToast } from '../src/contexts/toast-context'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token?: string }>()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()

  async function submit() {
    if (!token) {
      showToast('Solicita un nuevo enlace de recuperación.', 'error')
      return
    }
    if (password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres.', 'error')
      return
    }
    if (password !== confirmation) {
      showToast('La confirmación debe coincidir.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await api.resetPassword({ token, new_password: password })
      showToast('Contraseña actualizada. Ya puedes iniciar sesión.', 'success')
      router.replace('/auth')
    } catch (error) {
      showToast(friendlyErrorMessage(error, 'No se pudo actualizar la contraseña.'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Nueva contraseña</Text>
      <Text style={styles.muted}>Crea una contraseña segura de al menos 8 caracteres.</Text>
      <PasswordInput value={password} onChangeText={setPassword} placeholder="Nueva contraseña" />
      <PasswordInput value={confirmation} onChangeText={setConfirmation} placeholder="Confirmar contraseña" />
      <Pressable onPress={() => void submit()} disabled={submitting} style={[styles.button, submitting && styles.disabled]}>
        <Text style={styles.buttonText}>{submitting ? 'Actualizando…' : 'Guardar contraseña'}</Text>
      </Pressable>
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
})
