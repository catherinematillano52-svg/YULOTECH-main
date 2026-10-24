import { useCallback, useEffect, useState } from 'react'
import { createRealtimeClient } from '@neon/realtime/client'
import { RealtimeProvider, useLiveQuery } from '@neon/realtime-react'
import { useApi } from './api.js'

// Neon Realtime keeps the notification bell live. The sealing endpoint (npm run realtime) lives next to /api;
// when it or VITE_NEON_REALTIME_URL is missing, the bell falls back to polling GET /notifications.
const REALTIME_URL = import.meta.env.VITE_NEON_REALTIME_URL
const SEAL_URL = new URL('../realtime/notifications', document.baseURI).pathname
const client = REALTIME_URL ? createRealtimeClient({ url: REALTIME_URL }) : null

async function fetchSealed() {
  const res = await fetch(SEAL_URL, { method: 'POST', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Live updates unavailable (${res.status})`)
  return res.json()
}

// Live rows carry created_at as a UTC instant; the API sends the same column as Manila wall-clock text, which the formatters expect.
const wallClock = (v) => new Date(v).toLocaleString('sv-SE', { timeZone: 'Asia/Manila' })
const toNote = (r) => ({ id: r.id, message: r.message, isRead: r.is_read, at: wallClock(r.created_at) })

function Live({ sealed, onFail, children }) {
  const { data, status } = useLiveQuery(sealed, { refreshQuery: fetchSealed })
  useEffect(() => { if (status === 'error') onFail() }, [status, onFail])
  return children({ items: (data ?? []).map(toNote) })
}

// Renders children({ items }) with the signed-in user's newest notifications, live when Realtime is available.
export function NotificationFeed({ children }) {
  const [sealed, setSealed] = useState(client ? null : false) // null: connecting, false: use polling
  const poll = useApi(sealed === false ? '/notifications' : null)
  const fail = useCallback(() => setSealed(false), [])
  useEffect(() => {
    if (!client) return
    let live = true
    fetchSealed().then((s) => live && setSealed(s)).catch(() => live && setSealed(false))
    return () => { live = false }
  }, [])
  if (sealed) {
    return <RealtimeProvider client={client}><Live sealed={sealed} onFail={fail}>{children}</Live></RealtimeProvider>
  }
  return children({ items: poll.data?.items ?? [], reload: poll.reload })
}
