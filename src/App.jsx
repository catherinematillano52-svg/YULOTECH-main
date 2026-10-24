import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api.js'
import { Spinner, ToastProvider } from './ui.jsx'
import Login from './pages/Login.jsx'
import Shell from './Shell.jsx'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// Minimal hash router: "#/student/courses" -> "/student/courses"
const readPath = () => window.location.hash.replace(/^#/, '') || '/'
export function usePath() {
  const [path, setPath] = useState(readPath)
  useEffect(() => {
    const on = () => setPath(readPath())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return path
}
export const go = (to) => { window.location.hash = to }

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = checking session
  const [mustChange, setMustChange] = useState(false)

  useEffect(() => {
    api('/me').then((d) => setUser(d.user)).catch(() => setUser(null))
    const out = () => setUser(null)
    window.addEventListener('ssis:unauthorized', out)
    return () => window.removeEventListener('ssis:unauthorized', out)
  }, [])

  const login = useCallback((u, forceChange) => { setUser(u); setMustChange(!!forceChange); go(`/${u.role}`) }, [])
  const logout = useCallback(async () => {
    try { await api('/logout', { method: 'POST', body: {} }) } catch { /* already signed out */ }
    setUser(null); setMustChange(false); go('/')
  }, [])

  return (
    <ToastProvider>
      <AuthCtx.Provider value={{ user, login, logout }}>
        {user === undefined ? <div className="login"><Spinner label="Starting SSIS…" /></div>
          : user ? <Shell mustChange={mustChange} onChanged={() => setMustChange(false)} />
          : <Login />}
      </AuthCtx.Provider>
    </ToastProvider>
  )
}
