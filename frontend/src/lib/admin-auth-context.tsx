import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as adminApi from './admin-api'
import type { AdminUser } from './admin-api'

type AdminAuthContextValue = {
  admin: AdminUser | null
  isAuthenticated: boolean
  loading: boolean
  login: (input: { email: string; password: string; captcha_token: string; captcha_answer: number }) => Promise<void>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tokens = adminApi.getStoredAdminTokens()
    if (!tokens) {
      setLoading(false)
      return
    }
    adminApi
      .getAdminProfile()
      .then((profile) => {
        if (profile.role !== 'admin') {
          adminApi.storeAdminTokens(null)
          setAdmin(null)
        } else {
          setAdmin(profile)
        }
      })
      .catch(() => adminApi.storeAdminTokens(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(
    async (input: { email: string; password: string; captcha_token: string; captcha_answer: number }) => {
      const result = await adminApi.adminLogin(input)
      adminApi.storeAdminTokens({ access_token: result.access_token, refresh_token: result.refresh_token })
      setAdmin(result.user)
    },
    [],
  )

  const logout = useCallback(() => {
    adminApi.adminLogout()
    setAdmin(null)
  }, [])

  const value = useMemo<AdminAuthContextValue>(
    () => ({ admin, isAuthenticated: admin !== null, loading, login, logout }),
    [admin, loading, login, logout],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  return context
}
