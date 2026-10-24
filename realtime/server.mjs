// Seals live queries for the SSIS front end (Neon Realtime). The PHP API owns sessions, so each request is
// authorized by asking it who the cookie belongs to; the sealed query is then fixed to that user's rows.
// Run with: npm run realtime   (the Vite dev server proxies /realtime here)
import { createServer } from 'node:http'
import { createRealtime, rawSql } from '@neon/realtime/server'

try { process.loadEnvFile('.env.local') } catch { /* env may come from the shell */ }

const { NEON_REALTIME_SECRET, DATABASE_URL, SSIS_API = 'http://localhost/YULOTECH', REALTIME_PORT = '8787' } = process.env
if (!NEON_REALTIME_SECRET || !DATABASE_URL) {
  console.error('NEON_REALTIME_SECRET and DATABASE_URL are required. Run `neon deploy` to write them to .env.local.')
  process.exit(1)
}

const realtime = createRealtime({ secret: NEON_REALTIME_SECRET, db: new URL(DATABASE_URL).pathname.slice(1) })

async function currentUser(cookie) {
  const res = await fetch(`${SSIS_API}/api/index.php/me`, { headers: { cookie: cookie ?? '' } })
  return res.ok ? (await res.json()).user : null
}

// The 10 newest notifications for one user. Same rows as the API's GET /notifications.
const notificationsQuery = (userId) => rawSql(
  'SELECT id, message, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 10',
  [userId],
)

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  try {
    if (req.method !== 'POST' || req.url !== '/realtime/notifications') return send(res, 404, { error: 'Not found' })
    const user = await currentUser(req.headers.cookie)
    if (!user) return send(res, 401, { error: 'Not signed in.' })
    send(res, 200, await realtime.seal({ query: notificationsQuery(user.id) }))
  } catch (error) {
    console.error(error)
    send(res, 500, { error: 'Could not start live updates.' })
  }
}).listen(Number(REALTIME_PORT), '127.0.0.1', () => console.log(`Realtime sealing endpoint on http://127.0.0.1:${REALTIME_PORT}`))
