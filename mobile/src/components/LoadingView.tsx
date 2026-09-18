import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { colors } from '../theme'

export function LoadingView() {
  return <View style={styles.wrap}><ActivityIndicator color={colors.black} size="large" /></View>
}
const styles = StyleSheet.create({ wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white } })
