import { useEffect, useRef, useState } from 'react'
import { api, ago, useApi } from './api.js'
import { go, useAuth, usePath } from './App.jsx'
import { Alert, Field, Icon, Modal, PasswordInput, useToast } from './ui.jsx'
import { StudentDashboard, MyCourses, Grades, Documents, Clearance, Profile } from './pages/student.jsx'
import { RegistrarDashboard, StudentRecords, StudentRecord, EncodeGrades, AcademicRequests, RequestReview } from './pages/registrar.jsx'
import { CashierDashboard, Payments, Receipts } from './pages/cashier.jsx'
import { DepartmentDashboard, DepartmentClearance } from './pages/department.jsx'
import { AdminDashboard, UserManagement } from './pages/admin.jsx'

const PORTAL = { student: 'Student Portal', registrar: 'Registrar Portal', cashier: 'Cashier Portal', department: 'Department Portal', admin: 'Admin Portal' }
const NAV = {
  student: [['', 'Dashboard', 'grid'], ['courses', 'My Courses', 'list'], ['grades', 'Grades', 'checkSq'], ['documents', 'Documents Request', 'file'], ['clearance', 'Clearance', 'shield']],
  registrar: [['', 'Dashboard', 'grid'], ['students', 'Student Records', 'list'], ['grades', 'Encode Grades', 'checkSq'], ['requests', 'Academic Requests', 'file']],
  cashier: [['', 'Dashboard', 'grid'], ['payments', 'Payments', 'card'], ['receipts', 'Receipts', 'file']],
  department: [['', 'Dashboard', 'grid'], ['clearance', 'Clearance', 'shield']],
  admin: [['', 'Dashboard', 'grid'], ['users', 'User Management', 'users']],
}
const TERM = '1st Semester, A.Y. 2026–2027'

// path (after /<role>) -> [title, component]
function resolve(role, rest, id) {
  const T = {
    student: { '': ['Dashboard', StudentDashboard], courses: ['My Courses', MyCourses], grades: ['Grades', Grades], documents: ['Documents Request', Documents], clearance: ['Clearance', Clearance], profile: ['Profile', Profile] },
    registrar: { '': ['Dashboard', RegistrarDashboard], students: [id ? 'Student Record' : 'Student Records', id ? StudentRecord : StudentRecords], grades: ['Encode Grades', EncodeGrades], requests: [id ? 'Request Review' : 'Academic Requests', id ? RequestReview : AcademicRequests] },
    cashier: { '': ['Dashboard', CashierDashboard], payments: ['Payments', Payments], receipts: ['Receipts', Receipts] },
    department: { '': ['Dashboard', DepartmentDashboard], clearance: ['Clearance', DepartmentClearance] },
    admin: { '': ['Dashboard', AdminDashboard], users: ['User Management', UserManagement] },
  }
  return T[role][rest]
}

export default function Shell({ mustChange, onChanged }) {
  const { user } = useAuth()
  const path = usePath()
  const [open, setOpen] = useState(false)
  const [, base = '', rest = '', id] = path.split('?')[0].split('/')
  const role = user.role

  // Keep every signed-in user inside their own portal.
  useEffect(() => { if (base !== role) go(`/${role}`) }, [base, role])
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [path])
  const page = base === role ? resolve(role, rest, id) : null
  useEffect(() => { document.title = `${page ? page[0] + ' · ' : ''}SSIS` }, [page])

  const Page = page?.[1]
  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="side-brand">
          <span className="brand-chip"><Icon name="cap" size={24} /></span>
          <div><b>SSIS</b><span>Student Services Information System</span></div>
        </div>
        <div className="portal-label">{PORTAL[role]}</div>
        <nav className="nav">
          {NAV[role].map(([seg, label, icon]) => {
            const to = `/${role}${seg ? '/' + seg : ''}`
            const on = seg === '' ? rest === '' : rest === seg
            return <a key={label} href={`#${to}`} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}><Icon name={icon} size={20} />{label}</a>
          })}
        </nav>
        <div className="side-user">
          <div>
            <span className="avatar" style={{ width: 40, height: 40 }}><Icon name="user" size={20} /></span>
            <div style={{ display: 'block', padding: 0, background: 'none' }}>
              <b>{user.name}</b>
              <span>{role === 'student' ? 'Student · My account' : (user.unit || PORTAL[role])}</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="backdrop" onClick={() => setOpen(false)} />
      <div className="main">
        <Topbar title={page?.[0] || ''} onMenu={() => setOpen(true)} />
        <main className="page">{Page ? <Page key={path} id={id} /> : null}</main>
      </div>
      {mustChange && <ChangePassword forced onClose={onChanged} />}
    </div>
  )
}

function useClickOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && fn()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, fn])
}

function Topbar({ title, onMenu }) {
  const { user, logout } = useAuth()
  const [menu, setMenu] = useState(null) // 'bell' | 'user'
  const [pwd, setPwd] = useState(false)
  const [help, setHelp] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setMenu(null))
  const notes = useApi('/notifications')
  const unread = (notes.data?.items || []).filter((n) => !n.isRead).length

  const openBell = async () => {
    const next = menu === 'bell' ? null : 'bell'
    setMenu(next)
    if (next && unread) { try { await api('/notifications/read', { method: 'POST', body: {} }); setTimeout(notes.reload, 1500) } catch { /* ignore */ } }
  }
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu"><Icon name="menu" /></button>
        <div><h1>{title}</h1><p>{TERM}</p></div>
      </div>
      <div className="topbar-right" ref={ref}>
        <div className="pop-wrap">
          <button className="top-btn" onClick={openBell} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Icon name="bell" />{unread > 0 && <span className="dot" />}
          </button>
          {menu === 'bell' && (
            <div className="popover notif">
              <header>Notifications</header>
              <ul>
                {(notes.data?.items || []).map((n) => (
                  <li key={n.id} className={n.isRead ? '' : 'unread'}><Icon name="info" size={16} /><div>{n.message}<small>{ago(n.at)}</small></div></li>
                ))}
                {!(notes.data?.items || []).length && <li>You're all caught up.</li>}
              </ul>
            </div>
          )}
        </div>
        <div className="pop-wrap">
          <button className="top-btn" onClick={() => setMenu(menu === 'user' ? null : 'user')} aria-label="Account menu" aria-expanded={menu === 'user'}>
            <span className="top-avatar"><Icon name="user" size={18} /></span><Icon name="chevDown" size={14} />
          </button>
          {menu === 'user' && (
            <div className="popover">
              <div className="who"><b>{user.name}</b><span>{user.role}</span></div>
              {user.role === 'student' && <a className="item" href="#/student/profile" onClick={() => setMenu(null)}><Icon name="user" size={16} />Profile</a>}
              <button className="item" onClick={() => { setMenu(null); setPwd(true) }}><Icon name="settings" size={16} />Settings</button>
              <button className="item" onClick={() => { setMenu(null); setHelp(true) }}><Icon name="help" size={16} />Help &amp; Support</button>
              <button className="item danger" onClick={logout}><Icon name="logout" size={16} />Sign out</button>
            </div>
          )}
        </div>
      </div>
      {pwd && <ChangePassword onClose={() => setPwd(false)} />}
      {help && (
        <Modal title="Help & Support" subtitle="Need a hand with SSIS?" onClose={() => setHelp(false)}
          footer={<button className="btn btn-primary" onClick={() => setHelp(false)}>Got it</button>}>
          <div className="form-stack">
            <p>Forgot your password or locked out? Ask the Administrator to reset it from User Management.</p>
            <p>Document requests are reviewed by the Registrar. Status updates appear under the bell icon and on your request list.</p>
          </div>
        </Modal>
      )}
    </header>
  )
}

function ChangePassword({ onClose, forced }) {
  const toast = useToast()
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (pw.length < 8) return setErr('Password must be at least 8 characters.')
    if (pw !== pw2) return setErr('Passwords do not match.')
    setBusy(true)
    try { await api('/password', { method: 'POST', body: { password: pw } }); toast('Password updated.'); onClose() }
    catch (e2) { setErr(e2.message); setBusy(false) }
  }
  return (
    <Modal title={forced ? 'Set a new password' : 'Change password'} subtitle={forced ? 'Your administrator gave you a temporary password. Choose your own to continue.' : 'Use at least 8 characters.'}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>{forced ? 'Later' : 'Cancel'}</button>
        <button className="btn btn-primary" form="pw-form" disabled={busy}>Update password</button>
      </>}>
      <form id="pw-form" className="form-stack" onSubmit={submit}>
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="New password"><PasswordInput value={pw} onChange={setPw} autoComplete="new-password" placeholder="At least 8 characters" /></Field>
        <Field label="Confirm new password"><PasswordInput value={pw2} onChange={setPw2} autoComplete="new-password" placeholder="Repeat password" /></Field>
      </form>
    </Modal>
  )
}

