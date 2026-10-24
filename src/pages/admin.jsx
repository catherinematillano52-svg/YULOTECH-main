import { useEffect, useRef, useState } from 'react'
import { api, ago, qs, useApi, useDebounced } from '../api.js'
import { useAuth } from '../App.jsx'
import { Alert, Avatar, Badge, Card, Empty, Field, Icon, Load, Modal, Pagination, PasswordInput, SearchBox, Select, Stat, Table, toneOf, useToast } from '../ui.jsx'

const ROLE_LABEL = { student: 'Student', registrar: 'Registrar', department: 'Department', cashier: 'Cashier', admin: 'Admin' }
const OFFICES = ['Library', 'Laboratory', 'Department', 'Finance / Tuition', 'Student Affairs', 'Registrar']

export function AdminDashboard() {
  const res = useApi('/admin/dashboard')
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <Load res={res}>
      {(d) => (
        <>
          <div>
            <h1 style={{ fontSize: 28 }}>{greeting}, {d.firstName}</h1>
            <p className="muted">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · Here is what is happening in SSIS today.</p>
          </div>
          <div className="grid g4">
            <Stat label="Total users" value={d.total} icon="users" tone="green" sub="Registered accounts" />
            <Stat label="Students" value={d.students} icon="cap" tone="amber" sub={`${Math.round((d.students / (d.total || 1)) * 100)}% of all accounts`} />
            <Stat label="Staff" value={d.staff} icon="case" tone="blue" sub="Cashier, Registrar, Department" />
            <Stat label="Inactive" value={d.inactive} icon="lock" tone="red" color="red" sub="Blocked from login" />
          </div>
          <div className="grid g-main">
            <Card title="Accounts by role" subtitle={`Share of all ${d.total} accounts`}>
              {d.roles.map((r) => (
                <div className="role-row" key={r.role}><span>{ROLE_LABEL[r.role]}</span><div className="bar"><i style={{ width: `${r.pct}%` }} /></div><span>{r.n} ({r.pct}%)</span></div>
              ))}
            </Card>
            <Card title="Needs attention" subtitle="Items waiting for an admin" flush>
              {[['lock', 'red', `${d.attention.inactive} inactive account${d.attention.inactive === 1 ? '' : 's'}`, 'Blocked from login', 'inactive'],
                ['key', 'amber', `${d.attention.resets} password reset request${d.attention.resets === 1 ? '' : 's'}`, 'Waiting for approval', ''],
                ['clock', 'blue', `${d.attention.neverLoggedIn} account${d.attention.neverLoggedIn === 1 ? '' : 's'} never logged in`, 'Created recently', '']].map(([ic, tone, t, s, st]) => (
                <div className="attn" key={t}><span className={`stat-icon tone-bg-${tone}`}><Icon name={ic} size={18} /></span><div><b>{t}</b><small>{s}</small></div><a href={`#/admin/users${st ? '?status=' + st : ''}`}>Review</a></div>
              ))}
            </Card>
          </div>
          <div className="grid g2">
            <Card title="Recently created accounts" action={<Badge tone="green">New users</Badge>} flush>
              {d.accounts.map((a) => (
                <div className="list-row" key={a.id}>
                  <span className="person"><Avatar name={a.name} tone={toneOf(a.name)} /><span><b>{a.name}</b><small>{ROLE_LABEL[a.role]}{a.unit ? ` · ${a.unit}` : ''}</small></span></span>
                  <small className="muted">{ago(a.at)}</small>
                </div>
              ))}
            </Card>
            <Card title="Recent activity" subtitle="Latest actions across the system" flush>
              <div className="feed"><ul>
                {d.activity.map((a) => (
                  <li key={a.id}><span><i />{a.userId === d.myId ? 'You' : a.actor || 'System'} {a.action}</span><small>{ago(a.at)}</small></li>
                ))}
              </ul></div>
            </Card>
          </div>
        </>
      )}
    </Load>
  )
}

export function UserManagement() {
  const initial = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const [f, setF] = useState({ q: '', role: '', status: initial.get('status') || '', page: 1 })
  const [modal, setModal] = useState(null) // {mode:'add'|'edit'|'reset', user?}
  const q = useDebounced(f.q)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v, page: k === 'page' ? v : 1 }))
  const res = useApi(`/admin/users${qs({ ...f, q })}`)
  const toast = useToast()
  const { user: me } = useAuth()

  const toggle = async (u) => {
    try { await api(`/admin/users/${u.id}/status`, { method: 'POST', body: { status: u.status === 'active' ? 'inactive' : 'active' } }); toast(`${u.name} ${u.status === 'active' ? 'deactivated' : 'activated'}.`); res.reload() }
    catch (e) { toast(e.message, 'error') }
  }
  return (
    <>
      <Card title="All accounts" subtitle="View account details, update roles and manage login access."
        action={<button className="btn btn-primary" onClick={() => setModal({ mode: 'add' })}><Icon name="plus" size={18} />Add user</button>} flush>
        <div className="toolbar">
          <SearchBox value={f.q} onChange={set('q')} placeholder="Search by name or email…" />
          <Select value={f.role} onChange={set('role')} label="Role"><option value="">Role: All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Select value={f.status} onChange={set('status')} label="Status"><option value="">Status: All</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
        </div>
        <Load res={res}>
          {(d) => (
            <>
              <Table head={['Account', 'Role', 'Grade / Department', 'Status', 'Created', { label: 'Actions', right: true }]}>
                {d.items.map((u) => (
                  <tr key={u.id}>
                    <td><span className="person"><Avatar name={u.name} tone={toneOf(u.name)} /><span className="cell-two"><strong>{u.name}</strong><span>{u.email}</span></span></span></td>
                    <td><Badge tone={u.role === 'admin' ? 'blue' : 'gray'}>{ROLE_LABEL[u.role]}</Badge></td>
                    <td>{u.unit || '—'}</td>
                    <td><Badge tone={u.status === 'active' ? 'green' : 'red'} dot>{u.status === 'active' ? 'Active' : 'Inactive'}</Badge>{d.resetPending.includes(u.username) && <span className="faint" title="Password reset requested"><Icon name="key" size={13} /></span>}</td>
                    <td className="muted">{ago(u.createdAt)}</td>
                    <td className="r"><div className="row-actions">
                      <button className="link-btn" onClick={() => setModal({ mode: 'edit', user: u })}>Edit</button>
                      <Kebab disabled={u.id === me.id} onReset={() => setModal({ mode: 'reset', user: u })} onToggle={() => toggle(u)} active={u.status === 'active'} />
                    </div></td>
                  </tr>
                ))}
              </Table>
              {!d.items.length && <Empty>No accounts match your filters.</Empty>}
              <Pagination page={d.page} per={d.per} total={d.total} onPage={set('page')} noun="accounts" />
            </>
          )}
        </Load>
      </Card>
      {modal?.mode === 'reset' && <ResetPassword user={modal.user} onClose={() => setModal(null)} onDone={() => { setModal(null); toast('Temporary password set. The user must change it at next login.'); res.reload() }} />}
      {(modal?.mode === 'add' || modal?.mode === 'edit') && <UserForm user={modal.user} onClose={() => setModal(null)} onDone={(m) => { setModal(null); toast(m); res.reload() }} />}
    </>
  )
}

function Kebab({ onReset, onToggle, active, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <span className="kebab" ref={ref}>
      <button className="icon-btn" aria-label="More actions" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="more" size={18} /></button>
      {open && (
        <div className="popover">
          <button className="item" onClick={() => { setOpen(false); onReset() }}><Icon name="key" size={16} />Reset password</button>
          <button className={`item ${active ? 'danger' : ''}`} disabled={disabled} style={disabled ? { opacity: .5 } : null} onClick={() => { setOpen(false); onToggle() }}><Icon name="lock" size={16} />{active ? 'Deactivate account' : 'Activate account'}</button>
        </div>
      )}
    </span>
  )
}

function UserForm({ user, onClose, onDone }) {
  const editing = !!user
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', role: user?.role || '', unit: user?.unit || '', password: editing ? '' : '', status: user?.status || 'active' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      if (editing) { await api(`/admin/users/${user.id}`, { method: 'PUT', body: f }); onDone('Account updated.') }
      else { const r = await api('/admin/users', { method: 'POST', body: f }); onDone(`Account created. Username: ${r.username}`) }
    } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title={editing ? 'Edit user' : 'Add new user'} subtitle={editing ? 'Update the account details and role.' : 'Create an account and assign a role.'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="uf" disabled={busy}>{editing ? 'Save changes' : 'Add user'}</button></>}>
      <form id="uf" className="form-stack" onSubmit={submit}>
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Full name" required><input value={f.name} onChange={set('name')} placeholder="e.g. Maria Santos" /></Field>
        <Field label="Email" required><input type="email" value={f.email} onChange={set('email')} placeholder="name@ssis.edu" /></Field>
        <div className="form-grid">
          <Field label="Role" required><Select value={f.role} onChange={(v) => setF({ ...f, role: v, unit: v === 'department' ? OFFICES[0] : f.unit })}><option value="">Select role</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label={f.role === 'department' ? 'Clearance office' : 'Grade / Department'}>
            {f.role === 'department'
              ? <Select value={f.unit} onChange={(v) => setF({ ...f, unit: v })}>{OFFICES.map((o) => <option key={o}>{o}</option>)}</Select>
              : <input value={f.unit} onChange={set('unit')} placeholder={f.role === 'student' ? 'e.g. BSIT' : 'e.g. IT Support'} />}
          </Field>
        </div>
        {!editing && <Field label="Temporary password" required hint="The user must change this on first login."><PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} icon={false} autoComplete="new-password" /></Field>}
        <Field label="Status"><Select value={f.status} onChange={(v) => setF({ ...f, status: v })}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
      </form>
    </Modal>
  )
}

function ResetPassword({ user, onClose, onDone }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await api(`/admin/users/${user.id}/reset`, { method: 'POST', body: { password: pw } }); onDone() } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title="Reset password" subtitle={`${user.name} (${user.email})`} onClose={onClose} width={440}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="rp" disabled={busy}>Set temporary password</button></>}>
      <form id="rp" className="form-stack" onSubmit={submit}>
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Temporary password" required hint="The user must change this on their next login."><PasswordInput value={pw} onChange={setPw} icon={false} autoComplete="new-password" /></Field>
      </form>
    </Modal>
  )
}

