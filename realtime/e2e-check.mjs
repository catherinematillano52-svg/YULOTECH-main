// End-to-end check: subscribe to the sealed notifications query as Carlos, then have the registrar trigger a notification through the PHP API.
import { createRealtimeClient } from '@neon/realtime/client'
process.loadEnvFile('.env.local')
const API = 'http://127.0.0.1:8000/api/index.php', SEAL = 'http://127.0.0.1:8787/realtime/notifications'
const login = async (username, type) => {
  const r = await fetch(`${API}/login`, { method: 'POST', body: JSON.stringify({ username, password: 'password123', type }) })
  return r.headers.get('set-cookie').split(';')[0]
}
const carlos = await login('carlos', 'student')
const sealed = await (await fetch(SEAL, { method: 'POST', headers: { cookie: carlos } })).json()
const client = createRealtimeClient({ url: process.env.NEON_REALTIME_URL, logLevel: 'warn' })
const sub = client.subscribe(sealed)
const seen = []
sub.onChange((snap) => { seen.push(snap); console.log('state=%s rows=%d first=%j', snap.status ?? snap.state, snap.data?.length ?? -1, snap.data?.[0]) })
await new Promise((r) => setTimeout(r, 6000))
const jobert = await login('jobert', 'staff')
const res = await fetch(`${API}/registrar/grades/1`, { method: 'PUT', headers: { cookie: jobert }, body: JSON.stringify({ grades: [{ id: 1, grade: 2.25 }] }) })
console.log('registrar PUT grades ->', res.status)
await new Promise((r) => setTimeout(r, 6000))
sub.unsubscribe(); client.close(); process.exit(0)
