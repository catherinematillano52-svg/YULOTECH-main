import { useEffect, useState } from 'react'
import { api, fmtDate, fmtTime, peso, pesoShort, qs, useApi, useDebounced } from '../api.js'
import { go } from '../App.jsx'
import { Alert, Badge, Card, Empty, Field, Hero, Icon, Load, Modal, Pagination, SearchBox, Select, Stat, Table } from '../ui.jsx'

const clock = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export function CashierDashboard() {
  const res = useApi('/cashier/dashboard')
  return (
    <Load res={res}>
      {(d) => (
        <>
          <Hero title={d.name} sub="Cashier" rightLabel="Current Time" right={clock()} />
          <div className="grid g3">
            <Stat label="Today's Collections" value={pesoShort(d.todayTotal)} icon="card" sub={<><span>From {d.todayCount} transactions today</span></>} />
            <Stat label="Pending Payments" value={d.pendingStudents} icon="clock" tone="amber" sub={<span>Students awaiting payment</span>} />
            <Stat label="Receipts Issued Today" value={d.receiptsToday} icon="file" tone="green"
              sub={<><span>Official receipts generated</span><Badge tone="green">{d.receiptsDelta >= 0 ? '+' : ''}{d.receiptsDelta} vs yesterday</Badge></>} />
          </div>
          <div className="grid g-main">
            <Card title="Recent Transactions" subtitle="Today's payment activity" action={<Badge tone="green" dot>Live</Badge>} flush>
              <Table head={['Reference', 'Student', 'Fee Type', 'Method', 'Amount', 'Time', 'Status']}>
                {d.recent.map((t) => (
                  <tr key={t.ref}>
                    <td className="muted">#{t.ref}</td>
                    <td className="cell-two"><strong>{t.student}</strong><span>{t.studentNo}</span></td>
                    <td>{t.feeType}</td><td>{t.method}</td><td><b>{peso(t.amount)}</b></td><td className="muted">{fmtTime(t.at)}</td><td><Badge>{t.status}</Badge></td>
                  </tr>
                ))}
              </Table>
              {!d.recent.length && <Empty>No transactions yet today.</Empty>}
              <div style={{ padding: '14px 24px', textAlign: 'center' }}><a href="#/cashier/receipts">View all transactions →</a></div>
            </Card>
            <div className="stack">
              <Card title="Quick Actions" flush>
                <div style={{ padding: '0 20px 8px' }}>
                  <a className="quick" href="#/cashier/payments"><span className="stat-icon tone-bg-blue"><Icon name="plus" size={18} /></span><div><b>New Payment</b><small>Record a student payment</small></div><Icon name="chevRight" size={16} className="chev" /></a>
                  <a className="quick" href="#/cashier/receipts"><span className="stat-icon tone-bg-green"><Icon name="print" size={18} /></span><div><b>Print Receipt</b><small>Reprint an official receipt</small></div><Icon name="chevRight" size={16} className="chev" /></a>
                  <a className="quick" href="#/cashier/payments"><span className="stat-icon tone-bg-amber"><Icon name="clock" size={18} /></span><div><b>Pending Payments</b><small>{d.pendingStudents} students awaiting payment</small></div><Icon name="chevRight" size={16} className="chev" /></a>
                </div>
              </Card>
              <Card title="Collections by Method">
                {d.byMethod.map((m) => (
                  <div className="method" key={m.method}>
                    <div><span>{m.method}</span><span><b>{pesoShort(m.total)}</b> <small className="muted">{m.pct}%</small></span></div>
                    <div className="bar"><i style={{ width: `${m.pct}%` }} /></div>
                  </div>
                ))}
                {!d.byMethod.length && <p className="muted">Nothing collected yet today.</p>}
              </Card>
            </div>
          </div>
        </>
      )}
    </Load>
  )
}

const FEES = ['Tuition Fee', 'Misc. Fees', 'Laboratory Fee', 'Document Fee']

export function Payments() {
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(0)
  const [form, setForm] = useState({ feeType: 'Tuition Fee', amount: '', method: 'Cash', reference: '' })
  const [confirm, setConfirm] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [done, setDone] = useState(null)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const res = useApi(search ? `/cashier/students${qs({ q: search })}` : null)
  const students = res.data?.items || []
  const s = students[pick]
  useEffect(() => {
    const first = res.data?.items?.[0]
    if (first) setForm((f) => ({ ...f, amount: first.balanceDue ? first.balanceDue.toFixed(2) : '' }))
  }, [res.data])

  const doSearch = (e) => { e?.preventDefault(); setPick(0); setDone(null); setErr(''); setSearch(q.trim()) }
  const choose = (i) => { setPick(i); setDone(null); setForm((f) => ({ ...f, amount: students[i].balanceDue ? students[i].balanceDue.toFixed(2) : '' })) }
  const startConfirm = (e) => {
    e.preventDefault(); setErr('')
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) return setErr('Enter an amount greater than zero.')
    if (amt > s.balanceDue) return setErr(`Amount exceeds the outstanding balance of ${peso(s.balanceDue)}.`)
    if (form.method !== 'Cash' && !form.reference.trim()) return setErr('A reference number is required for GCash and Bank payments.')
    setConfirm(true)
  }
  const record = async () => {
    setBusy(true)
    try {
      const r = await api('/cashier/payments', { method: 'POST', body: { studentId: s.id, ...form, amount: parseFloat(form.amount) } })
      setDone({ or: r.orNumber }); setConfirm(false); setForm({ feeType: 'Tuition Fee', amount: '', method: 'Cash', reference: '' }); res.reload()
    } catch (x) { setConfirm(false); setErr(x.message) }
    setBusy(false)
  }
  const method = form.method === 'Bank' ? 'Bank Transfer' : form.method

  return (
    <>
      <Card title="Find Student" subtitle="Search by student number or name">
        <form onSubmit={doSearch} style={{ display: 'flex', gap: 14 }}>
          <SearchBox value={q} onChange={setQ} placeholder="Enter student number or name…" />
          <button className="btn btn-primary" style={{ height: 44, minWidth: 120 }}><Icon name="search" size={18} />Search</button>
        </form>
        {students.length > 1 && (
          <div className="chip-row" style={{ padding: '14px 0 0' }}>
            {students.map((x, i) => <button key={x.id} className={`chip ${i === pick ? 'on' : ''}`} onClick={() => choose(i)}>{x.name} · {x.studentNo}</button>)}
          </div>
        )}
        {search && !res.loading && !students.length && !res.error && <p className="muted" style={{ marginTop: 12 }}>No student found for “{search}”.</p>}
        {res.error && <p className="c-red" style={{ marginTop: 12 }}>{res.error}</p>}
      </Card>

      {s && (
        <>
          <div className="grid g2">
            <Card title="Student Info" action={<Badge>{s.enrollment}</Badge>}>
              <div className="grid g4" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {[['Name', s.name], ['Student Number', s.studentNo], ['Course', s.programCode === 'BSA' ? 'BS Accountancy' : s.program.replace('Bachelor of Science in ', 'BS ')], ['Year Level', `${s.yearLevel}${['st', 'nd', 'rd', 'th'][s.yearLevel - 1] || 'th'} Year`]]
                  .map(([k, v]) => <div key={k}><span className="muted" style={{ fontSize: 12 }}>{k}</span><br /><b style={{ fontSize: 15 }}>{v}</b></div>)}
              </div>
            </Card>
            <Card title="Balance Summary" action={<Badge>{s.paymentStatus}</Badge>}>
              <div className="grid g3" style={{ gap: 14 }}>
                <div><span className="muted" style={{ fontSize: 12 }}>Total Fees</span><br /><b>{peso(s.totalFees)}</b></div>
                <div><span className="muted" style={{ fontSize: 12 }}>Amount Paid</span><br /><b>{peso(s.amountPaid)}</b></div>
                <div><span className="muted" style={{ fontSize: 12 }}>Balance Due</span><br /><b className={s.balanceDue ? 'c-red' : 'c-green'}>{peso(s.balanceDue)}</b></div>
              </div>
            </Card>
          </div>

          <Card title="Record Payment" subtitle="Capture the latest payment for this student.">
            <form onSubmit={startConfirm} className="form-stack">
              <div className="grid g4" style={{ gap: 14 }}>
                <Field label="Payment For"><Select value={form.feeType} onChange={(v) => setForm({ ...form, feeType: v })}>{FEES.map((f) => <option key={f}>{f}</option>)}</Select></Field>
                <Field label="Amount"><input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></Field>
                <Field label="Payment Method"><Select value={form.method} onChange={(v) => setForm({ ...form, method: v })}><option>Cash</option><option>GCash</option><option>Bank Transfer</option></Select></Field>
                <Field label="Reference Number"><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={form.method === 'Cash' ? 'Not needed for cash' : 'e.g. GCM-2026-00418-01'} disabled={form.method === 'Cash'} /></Field>
              </div>
              {err && <Alert tone="error">{err}</Alert>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="muted">Methods: Cash, GCash, Bank • Reference required for GCash/Bank</span>
                <button className="btn btn-primary" style={{ height: 48, minWidth: 170 }} disabled={!s.balanceDue}>{s.balanceDue ? 'Record Payment' : 'No balance due'}</button>
              </div>
            </form>
          </Card>

          {done && (
            <div className="success-bar">
              <span className="ok"><Icon name="check" size={20} /></span>
              <div><b>Payment recorded successfully</b><small>Receipt {done.or} is ready for printing.</small></div>
              <button className="btn btn-primary" onClick={() => setReceipt(done.or)}>Print Receipt</button>
            </div>
          )}

          <Card title="Payment History" flush>
            <Table head={['Date', 'Description', 'Amount', 'Method', 'OR Number', 'Action']}>
              {s.history.map((h) => (
                <tr key={h.orNumber}>
                  <td>{fmtDate(h.date)}</td><td>{h.description}</td><td><b>{peso(h.amount)}</b></td><td>{h.method}</td><td>{h.orNumber}</td>
                  <td><button className="btn btn-sm" style={{ background: '#eef7f0', borderColor: 'transparent', color: '#2d6a45' }} onClick={() => setReceipt(h.orNumber)}>View Receipt</button></td>
                </tr>
              ))}
            </Table>
            {!s.history.length && <Empty>No payments recorded yet.</Empty>}
          </Card>

          {confirm && (
            <Modal title="Confirm payment" subtitle="Check the details before recording." onClose={() => setConfirm(false)} width={460}
              footer={<><button className="btn" onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-primary" onClick={record} disabled={busy}>{busy ? 'Recording…' : 'Confirm payment'}</button></>}>
              <div className="summary-box">
                {[['Student', s.name], ['Student number', s.studentNo], ['Payment for', form.feeType], ['Method', method], ...(form.method !== 'Cash' ? [['Reference no.', form.reference]] : [])]
                  .map(([k, v]) => <div key={k}><span>{k}</span><b style={{ fontWeight: 500 }}>{v}</b></div>)}
                <div style={{ borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 10 }}><b style={{ color: 'var(--ink)' }}>Amount</b><strong style={{ color: 'var(--blue)', fontSize: 22 }}>{peso(form.amount)}</strong></div>
              </div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Recording this payment will update the student's balance and issue an official receipt.</p>
            </Modal>
          )}
        </>
      )}
      {receipt && <ReceiptModal or={receipt} onClose={() => setReceipt(null)} />}
    </>
  )
}

export function ReceiptModal({ or, onClose }) {
  const res = useApi(`/cashier/receipts/${encodeURIComponent(or)}`)
  const r = res.data?.receipt
  return (
    <Modal title="Receipt preview" subtitle="Official receipt for this payment." onClose={onClose} width={500}
      footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn" onClick={() => window.print()} title="Choose “Save as PDF” in the print dialog">Download PDF</button><button className="btn btn-primary" onClick={() => window.print()}><Icon name="print" size={18} />Print</button></>}>
      {res.loading && <Empty>Loading receipt…</Empty>}
      {res.error && <Alert tone="error">{res.error}</Alert>}
      {r && (
        <div className="receipt print-area">
          <header><b>CuyoTech University</b><small>Student Services Information System</small><em>OFFICIAL RECEIPT</em></header>
          <dl>
            <dt>OR number</dt><dd>{r.orNumber}</dd><dt>Date</dt><dd>{fmtDate(r.date)}</dd><dt>Student</dt><dd>{r.student}</dd>
            <dt>Student number</dt><dd>{r.studentNo}</dd><dt>Course</dt><dd>{r.course}</dd><hr />
            <dt>{r.feeType}</dt><dd>{peso(r.amount)}</dd><dt>Method</dt><dd>{r.method}</dd>
            {r.reference && <><dt>Reference no.</dt><dd>{r.reference}</dd></>}<hr />
            <dt className="total">Total paid</dt><dd className="total">{peso(r.amount)}</dd>
            <dt>Remaining balance</dt><dd>{peso(r.remaining)}</dd>
          </dl>
          <div className="sign"><b>{r.cashier}, Cashier</b><br />This receipt is proof of payment.</div>
        </div>
      )}
    </Modal>
  )
}

const RANGES = [['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom Range']]

export function Receipts() {
  const [f, setF] = useState({ q: '', range: 'month', from: '', to: '', page: 1 })
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(null)
  const q = useDebounced(f.q)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v, page: k === 'page' ? v : 1 }))
  const res = useApi(`/cashier/receipts${qs({ ...f, q, per: 8 })}`)
  return (
    <>
      <Card title={<>All receipts {res.data && <Badge tone="green">{res.data.total} total</Badge>}</>} subtitle="View and manage official receipts, print copies and track payment records."
        action={<button className="btn btn-primary" onClick={() => go('/cashier/payments')}><Icon name="plus" size={18} />New receipt</button>} flush>
        <div className="toolbar">
          <SearchBox value={f.q} onChange={(v) => set('q', v)} placeholder="Search by OR number or student name…" />
          <div className="pop-wrap">
            <button className="btn" style={{ minWidth: 180, justifyContent: 'space-between' }} onClick={() => setOpen(!open)} aria-expanded={open}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="cal" size={16} />{RANGES.find((r) => r[0] === f.range)[1]}</span><Icon name="chevDown" size={16} />
            </button>
            {open && (
              <div className="popover" style={{ left: 0, right: 'auto', top: 46, minWidth: 220 }}>
                {RANGES.map(([k, l]) => <button key={k} className="item" style={{ justifyContent: 'space-between', fontWeight: f.range === k ? 600 : 400, background: f.range === k ? '#f4f5f7' : '' }} onClick={() => { set('range', k); if (k !== 'custom') setOpen(false) }}>{l}{f.range === k && <Icon name="check" size={16} />}</button>)}
                {f.range === 'custom' && <div className="form-stack" style={{ padding: 10 }}><input type="date" aria-label="From" value={f.from} onChange={(e) => set('from', e.target.value)} /><input type="date" aria-label="To" value={f.to} onChange={(e) => set('to', e.target.value)} /></div>}
                <button className="item" style={{ textDecoration: 'underline', color: 'var(--blue-700)' }} onClick={() => { setF({ q: '', range: 'month', from: '', to: '', page: 1 }); setOpen(false) }}>Clear filters</button>
              </div>
            )}
          </div>
        </div>
        <Load res={res}>
          {(d) => (
            <>
              <Table head={['OR Number', 'Student', 'Amount', 'Date', 'Cashier', { label: 'Actions', right: true }]}>
                {d.items.map((r) => (
                  <tr key={r.orNumber}>
                    <td><a href="#/cashier/receipts" onClick={(e) => { e.preventDefault(); setView(r.orNumber) }} style={{ fontWeight: 600 }}>{r.orNumber}</a></td>
                    <td className="cell-two"><strong>{r.student}</strong><span>{r.studentNo} · {r.program} — {r.yearLevel}{['st', 'nd', 'rd', 'th'][r.yearLevel - 1] || 'th'} Year</span></td>
                    <td><b>{peso(r.amount)}</b></td>
                    <td className="cell-two"><strong style={{ fontWeight: 500 }}>{fmtDate(r.date)}</strong><span>{fmtTime(r.date)}</span></td>
                    <td>{r.cashier}</td>
                    <td className="r"><div className="row-actions">
                      <button className="btn btn-sm btn-ok" onClick={() => setView(r.orNumber)}><Icon name="eye" size={14} />View</button>
                      <button className="btn btn-sm" style={{ color: 'var(--blue-600)', background: '#eef6fe', borderColor: 'transparent' }} onClick={() => setView(r.orNumber)}><Icon name="print" size={14} />Print</button>
                    </div></td>
                  </tr>
                ))}
              </Table>
              {!d.items.length && <Empty>No receipts found for this filter.</Empty>}
              <Pagination page={d.page} per={d.per} total={d.total} onPage={(p) => set('page', p)} noun="receipts" />
            </>
          )}
        </Load>
      </Card>
      {view && <ReceiptModal or={view} onClose={() => setView(null)} />}
    </>
  )
}
