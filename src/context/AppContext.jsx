import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../api/mockApi'
import { load, save } from '../utils/storage'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)
  const [theme, setTheme] = useState(() => load('theme', 'light'))
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])
  const [upgradeModal, setUpgradeModal] = useState(null) // { feature, message }

  const refreshUser = useCallback(async () => {
    const u = await api.fetchCurrentUser()
    setUser(u)
    if (u?.darkMode) setTheme('dark')
    return u
  }, [])

  const refreshNotifications = useCallback(async () => {
    if (!user && !load('sessionUserId')) {
      setNotifications([])
      return []
    }
    try {
      const list = await api.fetchNotifications()
      setNotifications(list)
      return list
    } catch {
      return []
    }
  }, [user])

  useEffect(() => {
    ;(async () => {
      try {
        const u = await api.fetchCurrentUser()
        setUser(u)
        if (u) {
          if (u.darkMode) setTheme('dark')
          const list = await api.fetchNotifications()
          setNotifications(list)
        }
      } finally {
        setBooting(false)
      }
    })()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    save('theme', theme)
  }, [theme])

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const login = async (creds) => {
    const u = await api.loginUser(creds)
    setUser(u)
    await refreshNotifications()
    toast(`Chào mừng trở lại, ${u.displayName}!`)
    return u
  }

  const signup = async (data) => {
    const u = await api.signUpUser(data)
    setUser(u)
    toast('Tạo tài khoản thành công!')
    return u
  }

  const logout = async () => {
    await api.logoutUser()
    setUser(null)
    setNotifications([])
    toast('Đã đăng xuất')
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
      } catch { /* local only */ }
    }
  }

  const openUpgrade = (feature, message) => {
    setUpgradeModal({ feature, message: message || 'Tính năng dành cho Piclet Gold' })
  }

  const closeUpgrade = () => setUpgradeModal(null)

  const activateGold = async (plan) => {
    const u = await api.upgradeToGold({ plan })
    setUser(u)
    await refreshNotifications()
    toast('✨ Piclet Gold đã kích hoạt!')
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
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
