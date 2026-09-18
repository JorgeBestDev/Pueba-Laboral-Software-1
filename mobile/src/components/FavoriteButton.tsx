import { Pressable, StyleSheet, Text } from 'react-native'
import { colors } from '../theme'

type FavoriteButtonProps = {
  active: boolean
  loading?: boolean
  onPress: () => void
  size?: 'small' | 'large'
}

export function FavoriteButton({ active, loading = false, onPress, size = 'small' }: FavoriteButtonProps) {
  const large = size === 'large'
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      hitSlop={8}
      style={[styles.button, large ? styles.largeButton : styles.smallButton, loading && styles.loading]}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      accessibilityState={{ checked: active, busy: loading }}
    >
      <Text style={[styles.icon, large && styles.largeIcon, active && styles.active]}>{active ? '♥' : '♡'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  smallButton: { width: 36, height: 36 },
  largeButton: { width: 46, height: 46 },
  loading: { opacity: 0.5 },
  icon: { color: colors.ink, fontSize: 21, lineHeight: 23 },
  largeIcon: { fontSize: 27, lineHeight: 29 },
  active: { color: colors.accent },
})
