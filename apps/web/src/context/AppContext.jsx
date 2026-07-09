import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../api/index.js'
import { resolveApiMode, getApiMode } from '../api/index.js'
import { load, save } from '../utils/storage'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)
  const [theme, setTheme] = useState(() => {
    try {
      return load('theme', 'light') || 'light'
    } catch {
      return 'light'
    }
  })
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])
  const [upgradeModal, setUpgradeModal] = useState(null)
  const [apiMode, setApiMode] = useState(null)

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.fetchCurrentUser()
      setUser(u)
      if (u?.darkMode) setTheme('dark')
      return u
    } catch {
      setUser(null)
      return null
    }
  }, [])

  const refreshNotifications = useCallback(async () => {
    try {
      const list = await api.fetchNotifications()
      setNotifications(Array.isArray(list) ? list : [])
      return list
    } catch {
      setNotifications([])
      return []
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await resolveApiMode()
        if (!cancelled) setApiMode(m)
        const u = await api.fetchCurrentUser()
        if (cancelled) return
        setUser(u)
        if (u) {
          if (u.darkMode) setTheme('dark')
          try {
            const list = await api.fetchNotifications()
            if (!cancelled) setNotifications(Array.isArray(list) ? list : [])
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        console.error('[App] boot error', e)
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      save('theme', theme)
    } catch { /* ignore */ }
  }, [theme])

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const login = async (creds) => {
    const u = await api.loginUser(creds)
    setUser(u)
    await refreshNotifications()
    toast(`Chào mừng trở lại, ${u.displayName || u.username}!`)
    return u
  }

  const signup = async (data) => {
    const u = await api.signUpUser(data)
    setUser(u)
    toast('Tạo tài khoản thành công!')
    return u
  }

  const logout = async () => {
    try {
      await api.logoutUser()
    } finally {
      setUser(null)
      setNotifications([])
      toast('Đã đăng xuất')
    }
  }

  const updateUser = async (patch) => {
    const u = await api.updateProfile(patch)
    setUser(u)
    if (patch.darkMode != null) setTheme(patch.darkMode ? 'dark' : 'light')
    return u
  }

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (user) {
      try {
        const u = await api.updateProfile({ darkMode: next === 'dark' })
        setUser(u)
      } catch { /* local theme only */ }
    }
  }

  const openUpgrade = (feature, message) => {
    setUpgradeModal({ feature, message: message || 'Tính năng đã mở cho mọi người' })
  }

  const closeUpgrade = () => setUpgradeModal(null)

  const activateGold = async (plan) => {
    const u = await api.upgradeToGold({ plan })
    setUser(u)
    await refreshNotifications()
    toast('Đã mở full tính năng!')
    return u
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const value = {
    user,
    booting,
    theme,
    notifications,
    unreadCount,
    toasts,
    toast,
    upgradeModal,
    openUpgrade,
    closeUpgrade,
    login,
    signup,
    logout,
    refreshUser,
    updateUser,
    toggleTheme,
    setTheme,
    activateGold,
    refreshNotifications,
    setNotifications,
    markAllRead: async () => {
      await api.markNotificationAsRead('all')
      await refreshNotifications()
    },
    markRead: async (id) => {
      await api.markNotificationAsRead(id)
      await refreshNotifications()
    },
    apiMode: () => apiMode || getApiMode(),
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
