import { useState } from 'react'
import { api, ago, qs, useApi, useDebounced } from '../api.js'
import { go } from '../App.jsx'
import { Alert, Avatar, Badge, Card, Empty, Field, Hero, Icon, Load, Modal, Pagination, SearchBox, Select, Table, toneOf, useToast } from '../ui.jsx'

const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0)

export function DepartmentDashboard() {
  const res = useApi('/department/dashboard')
  return (
    <Load res={res}>
      {(d) => (
        <>
          <Hero title={d.name} sub={`${d.office} Department`} rightLabel="Total Clearance Request" right={d.total} />
          <div className="grid g3">
            {[['Pending', d.pending, 'Awaiting review', 'clock', 'gray'], ['Cleared', d.cleared, 'Fully cleared', 'checkCircle', 'green'], ['On Hold', d.onHold, 'Requires action', 'alert', 'orange']].map(([l, n, s, ic, tone]) => (
              <div className="stat" key={l} style={{ minHeight: 168, justifyContent: 'space-between' }}>
                <div className="stat-top"><b style={{ fontWeight: 500 }}>{l}</b><span className={`stat-icon tone-bg-${tone}`} style={{ borderRadius: 12 }}><Icon name={ic} size={20} /></span></div>
                <strong className="stat-value" style={{ fontSize: 38 }}>{n}</strong>
                <span className="stat-sub"><span>{s}</span><Badge tone={tone === 'gray' ? 'gray' : tone}>{pct(n, d.total)}% of total</Badge></span>
              </div>
            ))}
          </div>
          <div className="grid g-main">
            <Card title="Recent clearance activity" subtitle="Latest updates across your department" action={<a href="#/department/clearance">See all →</a>} flush>
              {d.recent.map((r) => (
                <div className="list-row" key={r.studentNo}>
                  <span className="person"><Avatar name={r.student} tone={toneOf(r.student)} /><span><b>{r.student}</b><small>{r.studentNo} · {r.course.replace('Bachelor of Science in ', 'BS ')}</small></span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}><Badge dot>{r.status}</Badge><small className="muted" style={{ minWidth: 60, textAlign: 'right' }}>{r.at ? ago(r.at) : '—'}</small></span>
                </div>
              ))}
              {!d.recent.length && <Empty>No clearance activity yet.</Empty>}
            </Card>
            <Card title="Clearance overview" subtitle={`${d.total} total requests this semester`}>
              <div className="donut"><strong>{pct(d.cleared, d.total)}%</strong><span className="muted">cleared</span></div>
              <div className="segbar">
                <i style={{ width: `${pct(d.cleared, d.total)}%`, background: '#2e7d32' }} />
                <i style={{ width: `${pct(d.onHold, d.total)}%`, background: '#e8590c' }} />
                <i style={{ width: `${pct(d.pending, d.total)}%`, background: '#c4c7cc' }} />
              </div>
              {[['Cleared', d.cleared, '#2e7d32'], ['On Hold', d.onHold, '#e8590c'], ['Pending', d.pending, '#c4c7cc']].map(([l, n, c]) => <div className="legend" key={l}><span><i style={{ background: c }} />{l}</span><b>{n}</b></div>)}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 18, height: 44 }} onClick={() => go('/department/clearance')}>Review pending requests</button>
            </Card>
          </div>
        </>
      )}
    </Load>
  )
}

export function DepartmentClearance() {
  const [f, setF] = useState({ q: '', status: '', course: '', page: 1 })
  const [add, setAdd] = useState(false)
  const [hold, setHold] = useState(null)
  const q = useDebounced(f.q)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v, page: k === 'page' ? v : 1 }))
  const res = useApi(`/department/clearance${qs({ ...f, q, per: 9 })}`)
  const toast = useToast()
  const act = async (s, action, remarks = '') => {
    try { await api(`/department/clearance/${s.id}`, { method: 'POST', body: { action, remarks } }); toast(action === 'clear' ? `${s.name} cleared.` : `${s.name} placed on hold.`); res.reload() }
    catch (e) { toast(e.message, 'error') }
  }
  return (
    <>
      <Card title="Student clearance" subtitle="Review student records, update clearance status, and manage holds."
        action={<button className="btn btn-primary" onClick={() => setAdd(true)}><Icon name="plus" size={18} />Add student</button>} flush>
        <div className="toolbar">
          <SearchBox value={f.q} onChange={set('q')} placeholder="Search by student number or name…" />
          <Select value={f.status} onChange={set('status')} label="Status"><option value="">Status: All statuses</option><option>Pending</option><option>Cleared</option><option>On Hold</option></Select>
          <Select value={f.course} onChange={set('course')} label="Course"><option value="">Course: All courses</option>{(res.data?.courses || []).map((c) => <option key={c}>{c}</option>)}</Select>
        </div>
        <Load res={res}>
          {(d) => (
            <>
              <Table head={['Student No.', 'Student', 'Course', 'Status', { label: 'Actions', right: true }]}>
                {d.items.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.studentNo}</b></td>
                    <td><span className="person"><Avatar name={s.name} tone={toneOf(s.name)} size={32} />{s.name}</span></td>
                    <td className="muted">{s.course.replace('Bachelor of Science in ', 'BS ')}</td>
                    <td><Badge dot>{s.status}</Badge>{s.locked && <span className="faint" title="An earlier office has not cleared this student yet"><Icon name="lock" size={13} /> Locked</span>}</td>
                    <td className="r"><div className="row-actions">
                      <button className="btn btn-sm btn-ok" onClick={() => act(s, 'clear')} disabled={s.locked} title={s.locked ? 'Opens after the previous office clears this student' : ''}><Icon name="check" size={14} />Clear</button>
                      <button className="btn btn-sm btn-warn" onClick={() => setHold(s)}><Icon name="alert" size={14} />Hold</button>
                    </div></td>
                  </tr>
                ))}
              </Table>
              {!d.items.length && <Empty>No students match your filters.</Empty>}
              <Pagination page={d.page} per={d.per} total={d.total} onPage={set('page')} noun="students" />
            </>
          )}
        </Load>
      </Card>
      {add && <AddStudent courses={res.data?.courses || []} onClose={() => setAdd(false)} onDone={() => { setAdd(false); toast('Student added to the clearance list.'); res.reload() }} />}
      {hold && <HoldModal s={hold} onClose={() => setHold(null)} onSubmit={(r) => { act(hold, 'hold', r); setHold(null) }} />}
    </>
  )
}

function HoldModal({ s, onClose, onSubmit }) {
  const [r, setR] = useState('')
  return (
    <Modal title="Place on hold" subtitle={`${s.name} · ${s.studentNo}`} onClose={onClose} width={440}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSubmit(r)}>Place hold</button></>}>
      <Field label="Reason (shown to the student)"><textarea value={r} onChange={(e) => setR(e.target.value)} placeholder="e.g. Unreturned laboratory equipment" /></Field>
    </Modal>
  )
}

function AddStudent({ courses, onClose, onDone }) {
  const [f, setF] = useState({ studentNo: '', name: '', course: '', status: 'Pending' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await api('/department/clearance', { method: 'POST', body: f }); onDone() } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title="Add student" subtitle="Add a student to the clearance list." onClose={onClose} width={500}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="as" disabled={busy}>Add student</button></>}>
      <form id="as" onSubmit={submit} className="form-stack">
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Student Number"><input value={f.studentNo} onChange={set('studentNo')} placeholder="e.g. 2024-00456" /></Field>
        <Field label="Full Name" hint="Only needed for students who are not in the system yet."><input value={f.name} onChange={set('name')} placeholder="e.g. Sarah Jenkins" /></Field>
        <div className="form-grid">
          <Field label="Course"><Select value={f.course} onChange={(v) => setF({ ...f, course: v })}><option value="">Select course</option>{courses.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Clearance Status"><Select value={f.status} onChange={(v) => setF({ ...f, status: v })}><option>Pending</option><option>Cleared</option><option>On Hold</option></Select></Field>
        </div>
      </form>
    </Modal>
  )
}
