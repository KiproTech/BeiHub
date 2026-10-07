import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { useNavigate } from '../lib/router.jsx'
import { useToast } from './ToastContext.jsx'
import { takeNext } from '../lib/nextPath.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const toast = useToast()
  const handled = useRef(false)

  const refresh = useCallback(async () => {
    try {
      setUser(await api.getUser())
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    return api.onAuthChange(() => refresh())
  }, [refresh])

  // Returning from an email link (verify email / reset password / expired link)
  useEffect(() => {
    if (handled.current) return
    handled.current = true
    const ev = api.takeAuthEvent()
    if (!ev) return
    if (ev.type === 'recovery') {
      navigate('/reset-password', { replace: true })
    } else if (ev.type === 'error') {
      toast.error(ev.message)
      navigate('/login?expired=1', { replace: true })
    } else {
      toast.success('Email verified. You can now place orders.')
      refresh().then(() => navigate(takeNext() || '/account/orders', { replace: true }))
    }
  }, [navigate, toast, refresh])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      isVerified: !!user?.email_verified,
      refresh,
      signIn: async (email, password) => {
        const u = await api.signIn(email.trim(), password)
        setUser(u)
        return u
      },
      signUp: (email, password, meta) => api.signUp(email.trim(), password, meta),
      resendVerification: (email) => api.resendVerification(email.trim()),
      recoverPassword: (email) => api.recoverPassword(email.trim()),
      updatePassword: (pw) => api.updatePassword(pw),
      // re-check with the server whether the emailed link has been clicked (e.g. in another tab)
      checkVerified: async () => {
        const ok = await api.checkVerified()
        await refresh()
        return ok
      },
      updateProfile: async (patch) => {
        await api.updateProfile(patch)
        await refresh()
      },
      signOut: async () => {
        await api.signOut()
        setUser(null)
      },
    }),
    [user, loading, refresh],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
