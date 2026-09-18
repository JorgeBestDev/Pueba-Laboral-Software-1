import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; type: ToastType }
type ToastContextValue = { showToast: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    setToast(null)
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    const nextToast = { id: Date.now(), message, type }
    setToast(nextToast)
    timeoutRef.current = setTimeout(() => {
      setToast((current) => current?.id === nextToast.id ? null : current)
      timeoutRef.current = null
    }, 2800)
  }, [])

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View pointerEvents="box-none" style={styles.host}>
          <Pressable
            onPress={dismiss}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.toast, styles[toast.type]]}
          >
            <Text style={styles.icon}>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'}</Text>
            <Text style={styles.message}>{toast.message}</Text>
          </Pressable>
        </View>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider')
  return value
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 48, left: 16, right: 16, zIndex: 1000, alignItems: 'center' },
  toast: { minHeight: 48, maxWidth: 420, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 4, shadowColor: colors.black, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  success: { backgroundColor: colors.black },
  error: { backgroundColor: colors.danger },
  info: { backgroundColor: colors.ink },
  icon: { width: 20, height: 20, borderRadius: 10, color: colors.black, backgroundColor: colors.white, textAlign: 'center', lineHeight: 20, fontWeight: '800' },
  message: { flex: 1, color: colors.white, fontSize: 14, fontWeight: '600' },
})
