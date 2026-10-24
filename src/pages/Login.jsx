import { useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../App.jsx'
import { Alert, Field, Icon, Modal, PasswordInput, useToast } from '../ui.jsx'

const DEMO = [['Student', 'carlos'], ['Registrar', 'jobert'], ['Cashier', 'maria'], ['Department', 'msantos'], ['Admin', 'admin']]

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const [type, setType] = useState('student')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const d = await api('/login', { method: 'POST', body: { username, password, type } })
      login(d.user, d.mustChangePassword)
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <div className="login">
      <section className="login-art">
        <div className="brand-row"><span className="brand-chip"><Icon name="cap" size={24} /></span>Student Services Information System</div>
        <h2>Your student services, all in one place.</h2>
        <p>Check grades, request documents and track your clearance without the long lines.</p>
        <ul>
          <li><Icon name="checkCircle" size={22} />View your grades and enrollment</li>
          <li><Icon name="checkCircle" size={22} />Request documents online</li>
          <li><Icon name="checkCircle" size={22} />Track your clearance status</li>
        </ul>
        <footer><Icon name="lock" size={16} />Secure sign-in for authorized users only</footer>
      </section>

      <section className="login-form-side">
        <form className="login-box" onSubmit={submit} noValidate>
          <div className="login-logo"><Icon name="cap" size={30} /></div>
          <h1>SSIS</h1>
          <p className="sub">Sign in your account here.</p>

          <div className="seg" role="tablist" aria-label="Account type">
            <button type="button" role="tab" aria-selected={type === 'student'} className={type === 'student' ? 'on' : ''} onClick={() => setType('student')}><Icon name="cap" size={18} />Student</button>
            <button type="button" role="tab" aria-selected={type === 'staff'} className={type === 'staff' ? 'on' : ''} onClick={() => setType('staff')}><Icon name="case" size={18} />Staff</button>
          </div>

          {error && <div style={{ marginBottom: 16 }}><Alert tone="error">{error}</Alert></div>}

          <div className="form-stack">
            <Field label="Username">
              <span className="input-wrap">
                <Icon name="user" size={18} className="lead" />
                <input className="has-lead" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" autoFocus />
              </span>
            </Field>
            <Field label="Password"><PasswordInput value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" /></Field>
          </div>
          <div className="login-links"><button type="button" className="link-btn" onClick={() => setForgot(true)}>Forgot password?</button></div>
          <button className="btn btn-primary btn-lg" disabled={busy}><Icon name="login" size={20} />{busy ? 'Signing in…' : 'Login'}</button>
          <p className="sub" style={{ margin: '14px 0 0', fontSize: 13 }}>Don't have an account? <span style={{ color: 'var(--blue-600)', fontWeight: 600 }}>Contact your administrator</span></p>

          {import.meta.env.DEV && (
            <details className="demo">
              <summary>Demo accounts (dev only)</summary>
              <div className="demo-list">
                {DEMO.map(([r, u]) => (
                  <span key={u} style={{ display: 'contents' }}>
                    <span>{r}</span>
                    <button type="button" className="link-btn" style={{ textAlign: 'left' }}
                      onClick={() => { setType(r === 'Student' ? 'student' : 'staff'); setUsername(u); setPassword('password123') }}><code>{u}</code> — use</button>
                  </span>
                ))}
              </div>
            </details>
          )}
        </form>
        <p className="login-foot">© 2026 Student Portal. All rights reserved.</p>
      </section>

      {forgot && <Forgot initial={username} onClose={() => setForgot(false)} onDone={(m) => { setForgot(false); toast(m) }} />}
    </div>
  )
}

function Forgot({ initial, onClose, onDone }) {
  const [u, setU] = useState(initial)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { const d = await api('/forgot', { method: 'POST', body: { username: u } }); onDone(d.message) }
    catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title="Reset your password" subtitle="Send a reset request to the administrator." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="forgot" disabled={busy}>Send request</button></>}>
      <form id="forgot" className="form-stack" onSubmit={submit}>
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Username or email" required><input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" /></Field>
      </form>
    </Modal>
  )
}
