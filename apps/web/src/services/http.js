/**
 * HTTP client. Empty / localhost API in production browser → treat as offline (mock).
 */
const RAW_API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const FORCE_MOCK = import.meta.env.VITE_FORCE_MOCK === 'true'

function isLocalhostApi(url) {
  if (!url) return true
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return true
  }
}

/** Only use remote real API when explicitly configured to a non-localhost host */
export function shouldUseRealApiConfig() {
  if (FORCE_MOCK) return false
  if (!RAW_API) return false
  // In browser: if site is on real host but API points to localhost, skip real API
  if (typeof window !== 'undefined') {
    const pageLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isLocalhostApi(RAW_API) && !pageLocal) return false
  }
  return true
}

export function apiBase() {
  return RAW_API || ''
}

let authToken = null
try {
  authToken = localStorage.getItem('ld_token') || null
} catch {
  authToken = null
}

export function setAuthToken(token) {
  authToken = token
  try {
    if (token) localStorage.setItem('ld_token', token)
    else localStorage.removeItem('ld_token')
  } catch { /* private mode */ }
}

export function getAuthToken() {
  return authToken
}

export async function http(path, opts = {}) {
  const base = apiBase()
  if (!base) throw new Error('API URL not configured')

  const headers = { ...(opts.headers || {}) }
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), opts.timeoutMs || 15000)

  try {
    const res = await fetch(`${base}${path}`, {
      ...opts,
      headers,
      credentials: 'include',
      signal: opts.signal || controller.signal,
      body:
        opts.body && !(opts.body instanceof FormData) && typeof opts.body === 'object'
          ? JSON.stringify(opts.body)
          : opts.body,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(data.error || data.message || `HTTP ${res.status}`)
      err.status = res.status
      err.code = data.code
      throw err
    }
    return data
  } finally {
    clearTimeout(t)
  }
}

export async function checkApiHealth() {
  if (!shouldUseRealApiConfig()) return false
  const base = apiBase()
  if (!base) return false
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${base}/health`, { signal: controller.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}
