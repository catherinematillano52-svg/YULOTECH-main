import { useEffect, useState } from 'react'
import { api, fmtDate, fmtDateTime, qs, useApi, useDebounced } from '../api.js'
import { go } from '../App.jsx'
import { Alert, Avatar, Badge, Card, Empty, Field, Icon, Load, Modal, Pagination, SearchBox, Select, Stat, Table, toneOf, useToast } from '../ui.jsx'

export function RegistrarDashboard() {
  const res = useApi('/registrar/dashboard')
  return (
    <Load res={res}>
      {(d) => (
        <>
          <div><h1 style={{ fontSize: 28 }}>Welcome back, {d.firstName}</h1><p className="muted">Here is what is happening in the Registrar's office today.</p></div>
          <div className="grid g4">
            <Stat label="Total Students" value={d.totalStudents.toLocaleString()} sub="Enrolled this semester" />
            <Stat label="Grades to Encode" value={d.gradesToEncode} sub={`Across ${d.coursesToEncode} courses`} color="blue" />
            <Stat label="Pending Requests" value={d.pending} sub="Awaiting review" color="amber" />
            <Stat label="Ready for Release" value={d.ready} sub="Documents available" color="green" />
          </div>
          <div className="grid g-main">
            <Card title="Recent Academic Requests" action={<a href="#/registrar/requests">View all</a>} flush>
              {d.recent.map((r) => (
                <a key={r.id} href={`#/registrar/requests/${r.id}`} className="list-row" style={{ color: 'inherit' }}>
                  <div><b>{r.student}</b><small>{r.studentNo} · {r.docType}</small></div><Badge>{r.status}</Badge>
                </a>
              ))}
              {!d.recent.length && <Empty>No requests yet.</Empty>}
            </Card>
            <Card title="Quick Actions" flush>
              <div style={{ padding: 20 }}>
                {[['grades', 'Encode Grades', 'Enter or update student grades'], ['students', 'Student Records', 'Search and view student profiles'], ['requests', 'Academic Requests', `Review and process requests${d.profileEdits ? ` (${d.profileEdits} profile edit${d.profileEdits > 1 ? 's' : ''})` : ''}`]]
                  .map(([to, t, s]) => <a key={to} className="quick" href={`#/registrar/${to}`}><div><b>{t}</b><small>{s}</small></div><Icon name="chevRight" size={18} className="chev" /></a>)}
              </div>
            </Card>
          </div>
        </>
      )}
    </Load>
  )
}

function usePaged(initial = {}) {
  const [f, setF] = useState({ q: '', page: 1, ...initial })
  const q = useDebounced(f.q)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v, page: k === 'page' ? v : 1 }))
  return [f, set, { ...f, q }]
}

export function StudentRecords() {
  const [f, set, applied] = usePaged({ program: '', year: '', status: '' })
  const res = useApi(`/registrar/students${qs(applied)}`)
  const d = res.data
  return (
    <Card flush>
      <div className="toolbar" style={{ paddingTop: 20 }}>
        <SearchBox value={f.q} onChange={set('q')} placeholder="Search by name or student ID" />
        <Select value={f.program} onChange={set('program')} label="Program"><option value="">All Programs</option>{(d?.programs || []).map((p) => <option key={p}>{p}</option>)}</Select>
        <Select value={f.year} onChange={set('year')} label="Year level"><option value="">All Year Levels</option>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}{['st', 'nd', 'rd', 'th'][y - 1]} Year</option>)}</Select>
        <Select value={f.status} onChange={set('status')} label="Status"><option value="">All Statuses</option><option>Enrolled</option><option>On Leave</option><option>Pending</option></Select>
      </div>
      <Load res={res}>
        {(d) => (
          <>
            <Table head={['Student ID', 'Name', 'Program', 'Year level', 'Status', 'Action']}>
              {d.items.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.studentNo}</b></td><td>{s.name}</td><td>{s.programName.replace('Bachelor of Science in ', 'BS ')}</td>
                  <td>{s.yearLevel}{['st', 'nd', 'rd', 'th'][s.yearLevel - 1] || 'th'} Year</td><td><Badge>{s.status}</Badge></td>
                  <td><a href={`#/registrar/students/${s.id}`}>View Profile</a></td>
                </tr>
              ))}
            </Table>
            {!d.items.length && <Empty>No students match your filters.</Empty>}
            <Pagination page={d.page} per={d.per} total={d.total} onPage={set('page')} noun="students" simple />
          </>
        )}
      </Load>
    </Card>
  )
}

const yr = (n) => `${n}${['st', 'nd', 'rd', 'th'][n - 1] || 'th'} Year`

export function StudentRecord({ id }) {
  const res = useApi(`/registrar/students/${id}`)
  const [edit, setEdit] = useState(false)
  const toast = useToast()
  return (
    <Load res={res}>
      {({ student: s, grades }) => (
        <>
          <a className="back" href="#/registrar/students"><Icon name="chevLeft" size={16} />Back to Student Records</a>
          <Card>
            <div className="profile-head" style={{ padding: 0 }}>
              <Avatar name={s.name} size={72} />
              <div className="info"><h2>{s.name}</h2><p className="muted">{s.studentNo}</p>
                <div className="pills"><span className="pill">{s.programName}</span><span className="pill">{yr(s.yearLevel)}</span><Badge>{s.status}</Badge></div></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => setEdit(true)}>Edit Record</button>
                <button className="btn btn-primary" onClick={() => go(`/registrar/grades/${s.id}`)}>Encode Grades</button>
              </div>
            </div>
          </Card>
          <div className="grid g2">
            <Card title="Personal Information" flush><div className="kv">
              {[['Full Name', s.name], ['Date of Birth', fmtDate(s.birthDate, { month: 'long', day: 'numeric', year: 'numeric' })], ['Sex', s.gender], ['Email', s.email], ['Contact Number', s.contact], ['Address', s.address]]
                .flatMap(([k, v]) => [<div key={k}>{k}</div>, <div key={k + 'v'}>{v || '—'}</div>])}
            </div></Card>
            <Card title="Academic Information" flush><div className="kv">
              {[['Program', s.programName], ['Year Level', yr(s.yearLevel)], ['Section', s.section], ['Enrollment Status', s.status], ['Semester', s.term], ['Units Enrolled', s.units]]
                .flatMap(([k, v]) => [<div key={k}>{k}</div>, <div key={k + 'v'}>{v || '—'}</div>])}
            </div></Card>
          </div>
          <Card title="Current Grades" flush>
            <Table head={['Course Code', 'Course Title', 'Units', 'Grade', 'Remarks']}>
              {grades.map((g) => (
                <tr key={g.id}><td><b>{g.code}</b></td><td>{g.title}</td><td>{g.units}</td><td>{g.grade?.toFixed(2) ?? '—'}</td><td>{g.remarks ? <Badge>{g.remarks}</Badge> : '—'}</td></tr>
              ))}
            </Table>
            {!grades.length && <Empty>No enrolled courses.</Empty>}
          </Card>
          {edit && <EditRecord s={s} onClose={() => setEdit(false)} onDone={() => { setEdit(false); toast('Student record updated.'); res.reload() }} />}
        </>
      )}
    </Load>
  )
}

function EditRecord({ s, onClose, onDone }) {
  const [f, setF] = useState({ name: s.name, email: s.email || '', contact: s.contact || '', address: s.address || '', yearLevel: s.yearLevel, section: s.section || '', status: s.status })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await api(`/registrar/students/${s.id}`, { method: 'PUT', body: f }); onDone() } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title="Edit student record" subtitle={s.studentNo} onClose={onClose} width={620}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="er" disabled={busy}>Save changes</button></>}>
      <form id="er" onSubmit={submit} className="form-stack">
        {err && <Alert tone="error">{err}</Alert>}
        <div className="form-grid">
          <Field label="Full name" required><input value={f.name} onChange={set('name')} /></Field>
          <Field label="Email" required><input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Contact number"><input value={f.contact} onChange={set('contact')} /></Field>
          <Field label="Section"><input value={f.section} onChange={set('section')} /></Field>
          <Field label="Year level"><Select value={f.yearLevel} onChange={(v) => setF({ ...f, yearLevel: +v })}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{yr(y)}</option>)}</Select></Field>
          <Field label="Enrollment status"><Select value={f.status} onChange={(v) => setF({ ...f, status: v })}><option>Enrolled</option><option>On Leave</option><option>Pending</option></Select></Field>
          <div className="full"><Field label="Address"><input value={f.address} onChange={set('address')} /></Field></div>
        </div>
      </form>
    </Modal>
  )
}

export function EncodeGrades({ id }) {
  // /registrar/grades/<studentId>; without an id, pick a student first.
  const [sid, setSid] = useState(id || '')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const found = useApi(!sid && dq.length > 1 ? `/registrar/students${qs({ q: dq, per: 6 })}` : null)
  if (!sid) {
    return (
      <Card title="Encode Grades" subtitle="Find a student to enter or update their final grades.">
        <SearchBox value={q} onChange={setQ} placeholder="Search by student name or ID" />
        <div style={{ marginTop: 14 }}>
          {found.loading && <Empty>Searching…</Empty>}
          {(found.data?.items || []).map((s) => (
            <button key={s.id} className="quick" onClick={() => { setSid(String(s.id)); window.history.replaceState(null, '', `#/registrar/grades/${s.id}`) }}>
              <Avatar name={s.name} tone={toneOf(s.name)} /><div><b>{s.name}</b><small>{s.studentNo} · {s.programName}</small></div><Icon name="chevRight" size={18} className="chev" />
            </button>
          ))}
          {found.data && !found.data.items.length && <Empty>No student found.</Empty>}
        </div>
      </Card>
    )
  }
  return <GradeSheet sid={sid} onReset={() => { setSid(''); window.history.replaceState(null, '', '#/registrar/grades') }} />
}

function GradeSheet({ sid, onReset }) {
  const res = useApi(`/registrar/grades/${sid}`)
  const [vals, setVals] = useState({})
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const toast = useToast()
  useEffect(() => { if (res.data) setVals(Object.fromEntries(res.data.items.map((i) => [i.id, i.grade == null ? '' : i.grade.toFixed(2)]))) }, [res.data])
  const remark = (v) => (v === '' || isNaN(+v) ? null : +v <= 3 ? 'Passed' : 'Failed')
  const save = async () => {
    setErr(''); setBusy(true)
    try {
      await api(`/registrar/grades/${sid}`, { method: 'PUT', body: { grades: Object.entries(vals).map(([id, grade]) => ({ id: +id, grade })) } })
      toast('Grades saved.'); res.reload()
    } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  return (
    <Load res={res}>
      {(d) => (
        <>
          <Card>
            <div className="profile-head" style={{ padding: 0 }}>
              <Avatar name={d.student.name} size={48} />
              <div className="info"><h2 style={{ fontSize: 20 }}>{d.student.name}</h2><p className="muted">{d.student.studentNo}</p></div>
              <span className="pill">{d.term}</span>
              <button className="btn btn-sm" onClick={onReset}>Change student</button>
            </div>
          </Card>
          <Card title="Student Grades" subtitle="Enter the final grade for each enrolled subject (1.00 – 5.00)" flush>
            <Table head={['Course Code', 'Course Title', 'Units', 'Grade', 'Remarks']}>
              {d.items.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.code}</b></td><td>{c.title}</td><td>{c.units}</td>
                  <td><input className="grade-input" inputMode="decimal" aria-label={`Grade for ${c.code}`} value={vals[c.id] ?? ''} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })} placeholder="—" /></td>
                  <td>{remark(vals[c.id]) ? <Badge>{remark(vals[c.id])}</Badge> : '—'}</td>
                </tr>
              ))}
            </Table>
            {!d.items.length && <Empty>This student has no enrolled subjects.</Empty>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: 16, alignItems: 'center' }}>
              {err && <span className="c-red" style={{ marginRight: 'auto' }}>{err}</span>}
              <button className="btn" onClick={res.reload}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || !d.items.length}>Save Grades</button>
            </div>
          </Card>
        </>
      )}
    </Load>
  )
}

export function AcademicRequests() {
  const [f, set, applied] = usePaged({ type: '', status: '' })
  const res = useApi(`/registrar/requests${qs(applied)}`)
  const d = res.data
  const toast = useToast()
  const decide = async (id, action) => {
    try { await api(`/registrar/profile-edits/${id}`, { method: 'POST', body: { action } }); toast(`Profile edit ${action}d.`); res.reload() }
    catch (e) { toast(e.message, 'error') }
  }
  return (
    <>
      {d && (
        <div className="grid g4">
          <Stat label="Total Requests" value={d.stats.total} sub="All time" />
          <Stat label="Pending" value={d.stats.pending} sub="Awaiting review" color="amber" />
          <Stat label="Processing" value={d.stats.processing} sub="In progress" color="blue" />
          <Stat label="Ready" value={d.stats.ready} sub="Available to release" color="green" />
        </div>
      )}
      <Card flush>
        <div className="toolbar" style={{ paddingTop: 20 }}>
          <SearchBox value={f.q} onChange={set('q')} placeholder="Search by student or request ID" />
          <Select value={f.type} onChange={set('type')} label="Document type"><option value="">All Document Types</option><option>Certificate of Enrollment</option><option>Certificate of Grades</option><option>Certificate of Good Moral</option></Select>
          <Select value={f.status} onChange={set('status')} label="Status"><option value="">All Statuses</option><option>Pending</option><option>Processing</option><option>Ready</option><option>Rejected</option></Select>
        </div>
        <Load res={res}>
          {(d) => (
            <>
              <Table head={['Request ID', 'Student', 'Document Type', 'Purpose', 'Requested On', 'Status', 'Action']}>
                {d.items.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.code}</b></td>
                    <td className="cell-two"><strong>{r.student}</strong><span>{r.studentNo}</span></td>
                    <td>{r.docType}</td><td>{r.purpose}</td><td>{fmtDate(r.requestedOn)}</td><td><Badge>{r.status}</Badge></td>
                    <td><a href={`#/registrar/requests/${r.id}`}>Review</a></td>
                  </tr>
                ))}
              </Table>
              {!d.items.length && <Empty>No requests match your filters.</Empty>}
              <Pagination page={d.page} per={d.per} total={d.total} onPage={set('page')} noun="requests" simple />
            </>
          )}
        </Load>
      </Card>
      {d?.profileEdits?.length > 0 && (
        <Card title="Profile edit requests" subtitle="Students asked to update their details." flush>
          <Table head={['Student', 'Requested changes', 'Reason', 'Submitted', { label: 'Action', right: true }]}>
            {d.profileEdits.map((e) => (
              <tr key={e.id}>
                <td className="cell-two"><strong>{e.student}</strong><span>{e.studentNo}</span></td>
                <td className="cell-two"><strong>{e.newName}</strong><span>{e.newEmail} · {e.newContact}</span><span>{e.newAddress}</span></td>
                <td>{e.reason}</td><td>{fmtDate(e.createdAt)}</td>
                <td className="r"><div className="row-actions"><button className="btn btn-sm btn-danger" onClick={() => decide(e.id, 'reject')}>Reject</button><button className="btn btn-sm btn-primary" onClick={() => decide(e.id, 'approve')}>Approve</button></div></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  )
}

export function RequestReview({ id }) {
  const res = useApi(`/registrar/requests/${id}`)
  const [remark, setRemark] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const toast = useToast()
  const act = async (action) => {
    setErr('')
    if (action === 'reject' && !remark.trim()) return setErr('A remark is required when rejecting a request.')
    setBusy(true)
    try { await api(`/registrar/requests/${id}/action`, { method: 'POST', body: { action, remark } }); toast('Request updated.'); setRemark(''); res.reload() }
    catch (x) { setErr(x.message) }
    setBusy(false)
  }
  return (
    <Load res={res}>
      {({ request: r }) => {
        const done = r.status === 'Ready' || r.status === 'Rejected'
        const reviewed = r.timeline.length > 1
        return (
          <>
            <a className="back" href="#/registrar/requests"><Icon name="chevLeft" size={16} />Back to Academic Requests</a>
            <Card>
              <div className="profile-head" style={{ padding: 0 }}>
                <div className="info">
                  <h2 style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{r.code} <Badge>{r.status}</Badge></h2>
                  <p className="muted">{r.docType} · Requested on {fmtDate(r.requestedOn)}</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-danger" disabled={busy || done} onClick={() => act('reject')}>Reject</button>
                  <button className="btn" disabled={busy || done || r.status === 'Processing'} onClick={() => act('processing')}>Mark as Processing</button>
                  <button className="btn btn-primary" disabled={busy || done} onClick={() => act('approve')}>Approve Request</button>
                </div>
              </div>
            </Card>
            <div className="grid g2">
              <Card title="Request Details" flush><div className="kv">
                {[['Request ID', r.code], ['Document Type', r.docType], ['Purpose', r.purpose], ['Requested On', fmtDate(r.requestedOn)], ['Date Needed', fmtDate(r.dateNeeded)], ['Copies', r.copies], ['Release Method', r.delivery === 'Campus Pickup' ? 'Pick-up at Registrar' : 'Delivery'], ['Fee', `₱${r.fee.toFixed(2)}`]]
                  .flatMap(([k, v]) => [<div key={k}>{k}</div>, <div key={k + 'v'}>{v}</div>])}
              </div></Card>
              <Card title="Student Information" flush><div className="kv">
                {[['Name', r.student.name], ['Student ID', r.student.studentNo], ['Program', r.student.program], ['Year Level', yr(r.student.yearLevel)], ['Email', r.student.email], ['Contact Number', r.student.contact]]
                  .flatMap(([k, v]) => [<div key={k}>{k}</div>, <div key={k + 'v'}>{v || '—'}</div>])}
              </div></Card>
              <Card title="Request Timeline">
                <ul className="timeline">
                  {r.timeline.map((t, i) => <li key={i}><i /><div><b>{t.label}</b><small>{fmtDateTime(t.at)}{t.detail ? ` · ${t.detail}` : ''}</small></div></li>)}
                  {!reviewed && <li className="wait"><i /><div><b>Registrar review</b><small>Waiting for approval</small></div></li>}
                  {!done && <li className="todo"><i /><div><b>Ready for release / Rejected</b><small>Not yet available</small></div></li>}
                </ul>
              </Card>
              <Card title="Registrar Remarks">
                {r.studentRemarks && <div style={{ marginBottom: 12 }}><Alert>Student note: {r.studentRemarks}</Alert></div>}
                {done && r.remarks && <div style={{ marginBottom: 12 }}><Alert tone={r.status === 'Rejected' ? 'error' : 'ok'}>{r.remarks}</Alert></div>}
                <Field label="Add a remark (required when rejecting)" hint="Remarks are visible to the student once the status is updated.">
                  <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Write a note for the student or the processing team…" disabled={done} />
                </Field>
                {err && <div style={{ marginTop: 12 }}><Alert tone="error">{err}</Alert></div>}
              </Card>
            </div>
          </>
        )
      }}
    </Load>
  )
}
