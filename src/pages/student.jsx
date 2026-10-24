import { useMemo, useState } from 'react'
import { api, fmtDate, fmtDateTime, peso, to12h, useApi } from '../api.js'
import { Alert, Badge, Card, Empty, Field, Hero, Icon, Load, Modal, Select, Stat, Table, useToast } from '../ui.jsx'

export function StudentDashboard() {
  const res = useApi('/student/dashboard')
  return (
    <Load res={res}>
      {(d) => (
        <>
          <Hero title={`Hello, ${d.firstName}!`} sub={`${d.program} — ${d.yearLevel}${['st', 'nd', 'rd'][d.yearLevel - 1] || 'th'} Year · ${d.studentNo}`}
            rightLabel="Current GWA" right={d.gwa?.toFixed(2) ?? '—'} />
          <div className="grid g4">
            <Stat label="Enrolled units" value={d.units} sub="This semester" />
            <Stat label="Subjects" value={d.subjects} sub="Active classes" />
            <Stat label="Clearance" value={<>{d.cleared}<small>/{d.clearanceTotal}</small></>} sub="Departments cleared" />
            <Stat label="Documents" value={d.docsReady} sub="Ready to download" />
          </div>
          <div className="grid g2">
            <Card title="Announcements" action={<a href="#/student">See all</a>} flush>
              {d.announcements.map((a) => (
                <article key={a.id} className="announce">
                  <div><b>{a.title}</b><span className="tag">{a.tag}</span></div>
                  <p>{a.body}</p><small>{fmtDate(a.date)}</small>
                </article>
              ))}
            </Card>
            <Card title="Today's Schedule" action={<span className="muted">{d.scheduleDay}</span>} flush>
              {d.schedule.length === 0 && <Empty>No classes scheduled.</Empty>}
              {d.schedule.map((c, i) => (
                <div key={c.id} className={`sched ${i === 0 ? 'now' : ''}`}>
                  <i /><div><b>{c.title}</b><br /><small>{to12h(c.start_time)} – {to12h(c.end_time)} · {c.room}</small></div>
                  {i === 0 && <span className="tag">Now</span>}
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </Load>
  )
}

const scheduleLabel = (c) => `${c.days} ${to12h(c.start_time).replace(' ', '')}–${to12h(c.end_time).replace(' ', '')}`.replace(/:00/g, '')

export function MyCourses() {
  const res = useApi('/student/courses')
  return (
    <Load res={res}>
      {(d) => (
        <Card title="Enrolled Courses" subtitle={d.term} action={<span className="units-pill">{d.units} Units</span>} flush>
          <Table head={['Code', 'Subject', 'Instructor', 'Schedule', { label: 'Units', right: true }]}>
            {d.items.map((c) => (
              <tr key={c.id}>
                <td className="code" style={{ color: 'var(--blue-700)' }}>{c.code}</td>
                <td className="cell-two"><strong>{c.title}</strong><span>{c.room}</span></td>
                <td><b>{c.instructor}</b></td>
                <td>{scheduleLabel(c)}</td>
                <td className="r">{c.units}</td>
              </tr>
            ))}
          </Table>
          {!d.items.length && <Empty>You have no enrolled courses this term.</Empty>}
        </Card>
      )}
    </Load>
  )
}

export function Grades() {
  const res = useApi('/student/grades')
  return (
    <Load res={res}>
      {(d) => (
        <>
          <Card title="Grades" subtitle={d.term} action={<span className="units-pill">{d.units} Units</span>} flush>
            <Table head={['Code', 'Subject', 'Instructor', 'Schedule', { label: 'Grades', right: true }]}>
              {d.items.map((c) => (
                <tr key={c.id}>
                  <td className="code" style={{ color: '#2f7d57' }}>{c.code}</td>
                  <td className="cell-two"><strong>{c.title}</strong><span>{c.room}</span></td>
                  <td><b>{c.instructor}</b></td>
                  <td>{scheduleLabel(c)}</td>
                  <td className="r">{c.grade == null ? <span className="muted">Not yet posted</span> : <span className={c.grade > 3 ? 'grade-bad' : 'grade-ok'}>{c.grade.toFixed(2)}</span>}</td>
                </tr>
              ))}
            </Table>
            {!d.items.length && <Empty>No grades to show yet.</Empty>}
          </Card>
          <p className="muted">General weighted average: <b>{d.gwa?.toFixed(2) ?? '—'}</b> (1.00 is highest, 3.00 is passing).</p>
        </>
      )}
    </Load>
  )
}

export function Profile() {
  const res = useApi('/student/profile')
  const [edit, setEdit] = useState(false)
  const toast = useToast()
  return (
    <Load res={res}>
      {({ profile: p, pendingEdit }) => (
        <>
          <Hero title={p.name} sub={`${p.program} — Year ${p.yearLevel} · ${p.studentNo}`} rightLabel="Current GWA" right={p.gwa?.toFixed(2) ?? '—'}>
            <div className="avatar-xl"><Icon name="user" size={48} /></div>
          </Hero>
          <div className="grid g3">
            <Stat label="Student ID" value={p.studentNo} sub="Identification Number" />
            <Stat label="Program" value={p.program} sub={p.programName} />
            <Stat label="Year level" value={`Year ${p.yearLevel}`} sub="Current Academic Year" />
          </div>
          <Card title="Profile Overview" action={<button className="btn btn-primary btn-sm" onClick={() => setEdit(true)} disabled={pendingEdit}><Icon name="edit" size={16} />{pendingEdit ? 'Edit pending review' : 'Request Edit'}</button>}>
            <dl className="profile-grid" style={{ padding: '14px 4px 4px' }}>
              {[['Full name', p.name], ['Email address', p.email], ['Contact number', p.contact], ['Date of birth', fmtDate(p.birthDate, { month: 'long', day: 'numeric', year: 'numeric' })],
                ['Gender', p.gender], ['Civil status', p.civilStatus]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}
              <div className="full"><dt>Home address</dt><dd>{p.address || '—'}</dd></div>
            </dl>
          </Card>
          {edit && <ProfileEdit p={p} onClose={() => setEdit(false)} onDone={() => { setEdit(false); toast('Profile edit sent to the Registrar for approval.'); res.reload() }} />}
        </>
      )}
    </Load>
  )
}

function ProfileEdit({ p, onClose, onDone }) {
  const [f, setF] = useState({ name: p.name, email: p.email || '', contact: p.contact || '', birthDate: p.birthDate || '', gender: p.gender || 'Male', civilStatus: p.civilStatus || 'Single', address: p.address || '', reason: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await api('/student/profile-edit', { method: 'POST', body: f }); onDone() } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal title="Request profile edit" subtitle="Update the details you want changed. The Registrar will review it first." onClose={onClose} width={640}
      footer={<><span className="muted" style={{ marginRight: 'auto', fontSize: 13 }}>Sent to the Registrar for approval</span><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="pe" disabled={busy}>Submit for Approval</button></>}>
      <form id="pe" onSubmit={submit} className="form-stack">
        <div className="steps"><span><em className="on">1</em>You submit</span><Icon name="chevRight" size={14} /><span><em>2</em>Registrar reviews &amp; approves</span><Icon name="chevRight" size={14} /><span><em>3</em>Profile is updated</span></div>
        {err && <Alert tone="error">{err}</Alert>}
        <div className="form-grid">
          <Field label="Full Name"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="Email Address"><input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Contact Number"><input value={f.contact} onChange={set('contact')} /></Field>
          <Field label="Date of Birth"><input type="date" value={f.birthDate} onChange={set('birthDate')} /></Field>
          <Field label="Gender"><Select value={f.gender} onChange={(v) => setF({ ...f, gender: v })}><option>Male</option><option>Female</option><option>Other</option></Select></Field>
          <Field label="Civil Status"><Select value={f.civilStatus} onChange={(v) => setF({ ...f, civilStatus: v })}><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option></Select></Field>
          <div className="full"><Field label="Home Address"><input value={f.address} onChange={set('address')} /></Field></div>
          <div className="full"><Field label="Reason for change" required><textarea value={f.reason} onChange={set('reason')} placeholder="Explain why this information needs to be updated…" /></Field></div>
        </div>
      </form>
    </Modal>
  )
}

const DOC_TYPES = ['Certificate of Enrollment', 'Certificate of Grades', 'Certificate of Good Moral']
const PURPOSES = ['Employment', 'Scholarship', 'Internship', 'Transfer', 'Visa Application', 'Personal / Others']

export function Documents() {
  const res = useApi('/student/documents')
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const toast = useToast()
  return (
    <Load res={res}>
      {(d) => (
        <>
          {d.eligibility.blocked && <Alert tone="warn">You cannot submit a request while you have {d.eligibility.reasons.join(' or ')}. Please clear {d.eligibility.reasons.length > 1 ? 'them' : 'it'} first.</Alert>}
          <Card title="My Document Requests" subtitle="Track the status of every request you file."
            action={<button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={18} />New Request</button>} flush>
            <Table head={['Request', 'Document', 'Purpose', 'Filed', 'Fee', 'Status', '']}>
              {d.items.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.code}</b></td>
                  <td className="cell-two"><strong>{r.docType}</strong><span>{r.copies} {r.copies > 1 ? 'copies' : 'copy'} · {r.delivery}</span></td>
                  <td>{r.purpose}</td><td>{fmtDate(r.createdAt)}</td><td>{peso(r.fee)}</td>
                  <td><Badge>{r.status}</Badge></td>
                  <td className="r"><button className="link-btn" onClick={() => setDetail(r)}>Track</button></td>
                </tr>
              ))}
            </Table>
            {!d.items.length && <Empty>No requests yet. Click “New Request” to get started.</Empty>}
          </Card>
          {open && <NewRequest d={d} onClose={() => setOpen(false)} onDone={(code) => { setOpen(false); toast(`Request ${code} submitted.`); res.reload() }} />}
          {detail && (
            <Modal title={`${detail.code} · ${detail.docType}`} subtitle={`Requested ${fmtDate(detail.createdAt)}`} onClose={() => setDetail(null)}
              footer={<button className="btn" onClick={() => setDetail(null)}>Close</button>}>
              <div className="form-stack">
                <div><Badge>{detail.status}</Badge></div>
                {detail.status === 'Rejected' && <Alert tone="error"><b>Registrar's remarks:</b> {detail.remarks || 'No remarks provided.'}</Alert>}
                {detail.status !== 'Rejected' && detail.remarks && <Alert tone="info"><b>Registrar's remarks:</b> {detail.remarks}</Alert>}
                <ul className="timeline" style={{ padding: 0 }}>
                  {detail.timeline.map((t, i) => <li key={i}><i /><div><b>{t.label}</b><small>{t.detail} · {fmtDateTime(t.at)}</small></div></li>)}
                </ul>
              </div>
            </Modal>
          )}
        </>
      )}
    </Load>
  )
}

function NewRequest({ d, onClose, onDone }) {
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ docType: '', purpose: '', delivery: '', dateNeeded: '', copies: '', remarks: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF({ ...f, [k]: v?.target ? v.target.value : v })
  const fee = useMemo(() => {
    const n = parseInt(f.copies, 10)
    if (!n || n < 1 || !f.delivery) return 0
    return n * d.fees.perCopy + (f.delivery === 'Delivery' ? d.fees.delivery : 0)
  }, [f.copies, f.delivery, d.fees])
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const r = await api('/student/documents', { method: 'POST', body: { ...f, copies: parseInt(f.copies, 10) || 0 } }); onDone(r.code) }
    catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <Modal icon="file" title="New Document Request" subtitle="Fill in the details below to submit your document request." onClose={onClose} width={680}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="nr" disabled={busy || d.eligibility.blocked}>Submit Request</button></>}>
      <form id="nr" onSubmit={submit} className="form-stack">
        <Field label="Document Type" required><Select value={f.docType} onChange={set('docType')} className="w100"><option value="">Select a document type</option>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Purpose" required><Select value={f.purpose} onChange={set('purpose')}><option value="">Select purpose</option>{PURPOSES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Preferred Delivery Method" required><Select value={f.delivery} onChange={set('delivery')}><option value="">Select delivery method (Campus pickup / Delivery)</option><option>Campus Pickup</option><option>Delivery</option></Select></Field>
        <div className="form-grid">
          <Field label="Date Needed" required><input type="date" min={today} value={f.dateNeeded} onChange={set('dateNeeded')} /></Field>
          <Field label="Number of Copies" required><input type="number" min="1" max="10" value={f.copies} onChange={set('copies')} placeholder="Enter number of copies" /></Field>
        </div>
        <Field label="Additional Remarks (Optional)"><textarea value={f.remarks} onChange={set('remarks')} placeholder="Enter any additional details or special requests…" /></Field>
        <div className="fee-box"><div><b>Estimated Fee</b><small>Computed from number of copies and delivery method (campus pickup vs. delivery).</small></div><strong>{peso(fee)}</strong></div>
        {d.eligibility.blocked && <Alert tone="warn">You cannot submit a request while you have pending library books or an unpaid account balance. Please clear them first.</Alert>}
        <Alert>Your request will be reviewed by the registrar's office. You will be notified once it's been processed.</Alert>
        {err && <Alert tone="error">{err}</Alert>}
      </form>
    </Modal>
  )
}

export function Clearance() {
  const res = useApi('/student/clearance')
  return (
    <Load res={res}>
      {(d) => (
        <>
          <div className="clear-hero">
            <div className="l">
              <span className="shield"><Icon name="shield" size={30} /></span>
              <div><h2>Clearance</h2><p>Complete each office in order: academic departments, then accounting/cashier, then administrative offices. A later office opens once the one before it clears you.</p></div>
            </div>
            <div className="box"><b>Overall Clearance Status</b>
              <Badge tone={d.overall === 'CLEARED' ? 'green' : d.overall === 'ON HOLD' ? 'orange' : 'amber'}>{d.overall}</Badge>
              <p>{d.message}</p></div>
          </div>
          <Card title="Student Information">
            <div className="grid g4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              {[['Student Name', d.student.name], ['Student ID', d.student.studentNo], ['Program', d.student.program], ['Semester', d.term.split(',')[0]], ['Academic Year', d.term.split('A.Y. ')[1]]]
                .map(([k, v]) => <div key={k}><span className="muted" style={{ fontSize: 12 }}>{k}</span><br /><b>{v}</b></div>)}
            </div>
          </Card>
          <Card title="Clearance Requirements" flush>
            <Table head={['Step', 'Requirement', 'Status', 'Remarks']}>
              {d.steps.map((s) => (
                <tr key={s.step}>
                  <td>{s.step}</td><td>{s.office === 'Library' ? 'Library Clearance' : s.office}</td>
                  <td><Badge>{s.status}</Badge></td>
                  <td>{s.remarks || (s.office === 'Registrar' ? 'Final approval once all offices clear' : '—')}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}
    </Load>
  )
}
