import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import type { TextInputProps } from 'react-native'
import { colors } from '../theme'

export function PasswordInput({ style, ...props }: TextInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <View style={styles.container}>
      <TextInput {...props} secureTextEntry={!visible} style={[styles.input, style]} />
      <Pressable
        onPress={() => setVisible((current) => !current)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        hitSlop={8}
      >
        <View style={styles.eye}>
          <View style={styles.pupil} />
          {!visible && <View style={styles.slash} />}
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'relative', width: '100%' },
  input: { width: '100%', borderWidth: 1, borderColor: colors.line, padding: 14, paddingRight: 48, color: colors.ink },
  toggle: { position: 'absolute', right: 0, top: 0, height: '100%', width: 48, alignItems: 'center', justifyContent: 'center' },
  eye: { width: 22, height: 14, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pupil: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted },
  slash: { position: 'absolute', width: 25, height: 1.5, backgroundColor: colors.muted, transform: [{ rotate: '-35deg' }] },
})
