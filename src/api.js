import { useCallback, useEffect, useState } from 'react'

// Resolves to /api/index.php in dev and /YULOTECH/api/index.php when dist/ is served from XAMPP.
const BASE = new URL('../api/index.php', document.baseURI).pathname

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach the server. Make sure Apache and MySQL are running in XAMPP.')
  }
  let data = null
  try { data = await res.json() } catch { /* non-JSON error page */ }
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') window.dispatchEvent(new Event('ssis:unauthorized'))
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

export function qs(params) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v) })
  const s = p.toString()
  return s ? `?${s}` : ''
}

// Fetches `path` and re-fetches when it changes. `path` may be null to skip.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!path) return
    let live = true
    setState((s) => ({ ...s, loading: true, error: null }))
    api(path)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState({ data: null, error: error.message, loading: false }))
    return () => { live = false }
  }, [path, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

// ---- formatting
export const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const pesoShort = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })
const toDate = (s) => (s ? new Date(String(s).replace(' ', 'T')) : null)
export const fmtDate = (s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  const d = toDate(s); return d && !isNaN(d) ? d.toLocaleDateString('en-US', opts) : '-'
}
export const fmtTime = (s) => {
  const d = toDate(s); return d && !isNaN(d) ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '-'
}
export const fmtDateTime = (s) => `${fmtDate(s)} · ${fmtTime(s)}`
export function ago(s) {
  const d = toDate(s); if (!d) return 'Never'
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 86400 * 2) return 'Yesterday'
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400)}d ago`
  return fmtDate(s)
}
export const to12h = (t) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`
