import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as api from './api'
import type { User } from './api'

type AuthContextValue = {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; password: string; first_name?: string; last_name?: string }) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (input: { email?: string; first_name?: string; last_name?: string }) => Promise<void>
  changePassword: (input: { current_password: string; new_password: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tokens = api.getStoredTokens()
    if (!tokens) {
      setLoading(false)
      return
    }
    api
      .getMe()
      .then(setUser)
      .catch(() => api.storeTokens(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login({ email, password })
    api.storeTokens({ access_token: result.access_token, refresh_token: result.refresh_token })
    setUser(result.user)
  }, [])

  const registerUser = useCallback(
    async (input: { email: string; password: string; first_name?: string; last_name?: string }) => {
      const result = await api.register(input)
      api.storeTokens({ access_token: result.access_token, refresh_token: result.refresh_token })
      setUser(result.user)
    },
    [],
  )

  const logoutUser = useCallback(async () => {
    await api.logout().catch(() => undefined)
    setUser(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const profile = await api.getMe()
    setUser(profile)
  }, [])
  const updateProfile = useCallback(async (input: { email?: string; first_name?: string; last_name?: string }) => {
    setUser(await api.updateProfile(input))
  }, [])
  const changePassword = useCallback(
    async (input: { current_password: string; new_password: string }) => {
      await api.changePassword(input)
    },
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      loading,
      login,
      register: registerUser,
      logout: logoutUser,
      refreshProfile,
      updateProfile,
      changePassword,
    }),
    [user, loading, login, registerUser, logoutUser, refreshProfile, updateProfile, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
