import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { initials } from './api.js'

// ---------- Icons (24px stroke set)
const P = {
  cap: <><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /><path d="M22 10v6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14c2.5.6 4 2.6 4 5" /></>,
  case: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.3 4M6.5 7.6A16 16 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  login: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  list: <><path d="M4 6h16M4 12h10M4 18h16" /></>,
  checkSq: <><path d="m9 11 3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 12h6" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  chevDown: <path d="m6 9 6 6 6-6" />,
  chevRight: <path d="m9 6 6 6-6 6" />,
  chevLeft: <path d="m15 6-6 6 6 6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  print: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></>,
  download: <><path d="M12 4v11m-5-5 5 5 5-5" /><path d="M4 20h16" /></>,
  upload: <><path d="M12 16V5m-5 5 5-5 5 5" /><path d="M4 20h16" /></>,
  alert: <><path d="M10.3 4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M16 7l3 3" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></>,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
  check: <path d="m5 12 5 5 9-10" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  coins: <><circle cx="9" cy="9" r="6" /><path d="M15 9.5A6 6 0 1 1 9.5 15" /></>,
}
export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>
  )
}

// ---------- Toasts
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, kind = 'success') => {
    const id = Math.random()
    setItems((l) => [...l, { id, message, kind }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <Icon name={t.kind === 'error' ? 'alert' : 'checkCircle'} size={18} /> {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- Primitives
const BADGE = {
  Cleared: 'green', Enrolled: 'green', Active: 'green', Passed: 'green', Paid: 'green', Ready: 'green', Approved: 'green', Done: 'green',
  Pending: 'amber', 'On Leave': 'amber', 'Partially Paid': 'red-soft', Unpaid: 'red-soft', 'Fully Paid': 'green',
  Processing: 'blue', Delivery: 'blue',
  Failed: 'red', Inactive: 'red', Rejected: 'red', 'On Hold': 'orange', Locked: 'gray',
}
export function Badge({ children, tone, dot = false }) {
  return <span className={`badge badge-${tone || BADGE[children] || 'gray'}`}>{dot && <i />}{children}</span>
}
export function Avatar({ name, tone = 0, size = 36 }) {
  return <span className={`avatar tone-${tone % 5}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</span>
}
export const toneOf = (s = '') => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 5

export function Spinner({ label = 'Loading…' }) {
  return <div className="state"><span className="spinner" /> {label}</div>
}
export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state-error">
      <Icon name="alert" /> <span>{error}</span>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  )
}
export function Empty({ children }) { return <div className="state">{children}</div> }
export function Load({ res, children }) {
  if (res.loading && !res.data) return <Spinner />
  if (res.error && !res.data) return <ErrorState error={res.error} onRetry={res.reload} />
  return children(res.data)
}

export function Card({ title, subtitle, action, children, className = '', flush }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          {action}
        </header>
      )}
      <div className={flush ? '' : 'card-body'}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub, icon, tone, color }) {
  return (
    <div className="stat">
      <div className="stat-top"><span className="eyebrow">{label}</span>{icon && <span className={`stat-icon tone-bg-${tone || 'blue'}`}><Icon name={icon} size={18} /></span>}</div>
      <strong className={`stat-value ${color ? 'c-' + color : ''}`}>{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

export function Hero({ eyebrow = 'Welcome back!', title, sub, right, rightLabel, children }) {
  return (
    <div className="hero">
      {children}
      <div className="hero-main">
        <span className="hero-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {sub && <span className="hero-sub">{sub}</span>}
      </div>
      {right != null && <div className="hero-right"><span>{rightLabel}</span><strong>{right}</strong></div>}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder, className = '' }) {
  return (
    <label className={`search ${className}`}>
      <Icon name="search" size={18} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  )
}
export function Select({ value, onChange, children, label, className = '' }) {
  return (
    <span className={`select ${className}`}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>{children}</select>
      <Icon name="chevDown" size={16} />
    </span>
  )
}
export function Field({ label, required, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}{required && <b> *</b>}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}
export function PasswordInput({ value, onChange, placeholder, autoComplete, icon = true }) {
  const [show, setShow] = useState(false)
  return (
    <span className="input-wrap">
      {icon && <Icon name="lock" size={18} className="lead" />}
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={autoComplete} className={icon ? 'has-lead' : ''} />
      <button type="button" className="trail" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
        <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </span>
  )
}
export function Alert({ tone = 'info', children }) {
  return <div className={`alert alert-${tone}`}><Icon name={tone === 'warn' ? 'alert' : tone === 'error' ? 'alert' : 'info'} size={18} /><div>{children}</div></div>
}

export function Modal({ title, subtitle, onClose, children, footer, width = 480, icon }) {
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector('input, select, textarea, button.btn-primary')?.focus()
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head">
          {icon && <span className="modal-icon"><Icon name={icon} size={24} /></span>}
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={20} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Pagination({ page, per, total, onPage, noun = 'results', simple }) {
  const pages = Math.max(1, Math.ceil(total / per))
  const from = total ? (page - 1) * per + 1 : 0
  const to = Math.min(total, page * per)
  const nums = Array.from({ length: Math.min(pages, 5) }, (_, i) => {
    const start = Math.min(Math.max(1, page - 2), Math.max(1, pages - 4))
    return start + i
  })
  return (
    <div className="pager">
      <span className="muted">Showing {from}–{to} of {total} {noun} <i className="faint">{per} per page</i></span>
      {pages > 1 && (
        <div className="pager-btns">
          {simple ? (
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
          ) : (
            <button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><Icon name="chevLeft" size={16} /></button>
          )}
          {nums.map((n) => <button key={n} className={`page-btn ${n === page ? 'on' : ''}`} onClick={() => onPage(n)} aria-current={n === page}>{n}</button>)}
          {simple ? (
            <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
          ) : (
            <button className="page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><Icon name="chevRight" size={16} /></button>
          )}
        </div>
      )}
    </div>
  )
}

export function Table({ head, children, empty }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{head.map((h, i) => <th key={i} className={h.right ? 'r' : ''}>{h.label ?? h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  )
}
