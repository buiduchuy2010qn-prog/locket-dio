const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

let authToken = localStorage.getItem('ld_token') || null

export function setAuthToken(token) {
  authToken = token
  if (token) localStorage.setItem('ld_token', token)
  else localStorage.removeItem('ld_token')
}

export function getAuthToken() {
  return authToken
}

export async function http(path, opts = {}) {
  const headers = { ...(opts.headers || {}) }
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    credentials: 'include',
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
}

export function apiBase() {
  return API_URL
}

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(2500) })
    return res.ok
  } catch {
    return false
  }
}
