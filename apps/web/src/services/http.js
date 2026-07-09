/**
 * HTTP client for Locket Dio API.
 * Dev: Vite proxies /api → localhost:4000 when VITE_API_URL is empty.
 * Prod: set VITE_API_URL to the public API origin.
 */
const RAW = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const FORCE_MOCK = import.meta.env.VITE_FORCE_MOCK === 'true'

function isLocalhostHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

/**
 * Resolve API base URL.
 * - Explicit VITE_API_URL wins (unless localhost baked into remote static site → skip)
 * - Empty → same-origin (works with reverse proxy or Vite proxy)
 */
export function apiBase() {
  if (FORCE_MOCK) return ''
  if (typeof window !== 'undefined') {
    const pageLocal = isLocalhostHost(window.location.hostname)
    if (RAW) {
      try {
        const u = new URL(RAW, window.location.origin)
        // Static CDN/host with baked localhost API → don't use it
        if (isLocalhostHost(u.hostname) && !pageLocal) return ''
        return u.origin === window.location.origin ? '' : RAW
      } catch {
        return RAW
      }
    }
    return '' // relative /api via proxy or same host
  }
  return RAW || ''
}

export function shouldUseRealApiConfig() {
  if (FORCE_MOCK) return false
  // Always try health check unless forced mock
  return true
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
  const headers = { ...(opts.headers || {}) }
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), opts.timeoutMs || 20000)

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
  if (FORCE_MOCK) return false
  const base = apiBase()
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(`${base}/health`, {
      signal: controller.signal,
      credentials: 'include',
    })
    clearTimeout(t)
    if (!res.ok) return false
    const data = await res.json().catch(() => ({}))
    return data.ok === true || data.service === 'locket-dio-api' || res.ok
  } catch {
    return false
  }
}
