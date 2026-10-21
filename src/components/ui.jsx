import { useEffect, useRef, useState } from 'react'
import * as I from './icons'
import { useStore } from '../store'
import { fmtDT, fmtDur, patientOf, stageOf } from '../lib/logic'

export const Icon = ({ name, size = 16, ...r }) => {
  const C = I[name] || I.Circle
  return <C size={size} strokeWidth={1.8} aria-hidden="true" {...r} />
}

const TONES = {
  ok: ['Approved', 'Filed', 'Available', 'Received', 'Closed', 'Completed', 'Resolved', 'Accepted', 'Coded', 'Complete', 'Matched', 'Manually linked', 'Clear', 'present', 'Closed & stored', 'Good'],
  info: ['Submitted', 'In Processing', 'QC Pending', 'Pending Review', 'In Progress', 'Issued', 'Released', 'Return Submitted', 'Return Pending', 'Acknowledged', 'Awaiting Storage', 'In Transit', 'Responded', 'Requested', 'Pending', 'processing', 'Awaiting MRD receipt', 'Awaiting QC', 'Awaiting coding & completeness', 'Complete – ready to close', 'Awaiting storage location', 'Awaiting scanning'],
  warn: ['Awaiting Scan', 'On Hold', 'Incomplete', 'Open', 'Awaiting ward handover', 'Incomplete – deficiency open', 'Minor wear', 'Routine', 'L1 · MRD Supervisor', 'Urgent', 'Unclear'],
  bad: ['Overdue', 'QC Rejected', 'Rejected', 'Missing', 'missing', 'Damaged', 'Discrepancy', 'Exception', 'Unmatched', 'Unclassified', 'Rescan required', 'L2 · Medical Superintendent', 'Emergency', 'Late Entry', 'Incomplete page', 'Blank', 'Wrong orientation', 'Wrong patient', 'Damaged / torn pages', 'Water damaged'],
  mute: ['Waived', 'waived', 'Cancelled', 'Entered in Error', 'Admitted', 'Returned to source', 'With Ward', 'Not created'],
}
export const toneOf = (v) => Object.keys(TONES).find((k) => TONES[k].includes(v)) || 'info'

export function Badge({ children, tone, dot = true, title }) {
  const v = typeof children === 'string' ? children : ''
  const t = tone || toneOf(v)
  return <span className={`badge badge-${t}`} title={title}>{dot && <i />}{children}</span>
}

export function Button({ children, icon, variant = 'default', size, className = '', ...r }) {
  return (
    <button type="button" className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} {...r}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children && <span>{children}</span>}
    </button>
  )
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide, side }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    setTimeout(() => ref.current?.querySelector('input,select,textarea,button:not(.x)')?.focus(), 30)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={`overlay ${side ? 'overlay-side' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className={`modal ${wide ? 'modal-wide' : ''} ${side ? 'modal-side' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
          <button className="x icon-btn" onClick={onClose} aria-label="Close"><Icon name="X" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, hint, required, children, error }) {
  return (
    <label className={`field ${error ? 'has-err' : ''}`}>
      <span className="field-label">{label}{required && <b aria-hidden> *</b>}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-err">{error}</span>}
    </label>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.icon && <Icon name={t.icon} size={15} />}{t.label}{t.count != null && <em>{t.count}</em>}
        </button>
      ))}
    </div>
  )
}

export function Kpi({ label, value, sub, tone = 'ink', icon, onClick, hint }) {
  return (
    <button type="button" className={`kpi kpi-${tone}`} onClick={onClick} disabled={!onClick} title={hint}>
      <div className="kpi-top"><span>{label}</span>{icon && <Icon name={icon} size={17} />}</div>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
      {onClick && <Icon name="ArrowUpRight" size={14} className="kpi-go" />}
    </button>
  )
}

export function Empty({ icon = 'Inbox', title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-ic"><Icon name={icon} size={22} /></div>
      <h4>{title}</h4>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function PageHead({ title, kicker, children, info }) {
  return (
    <div className="page-head">
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
        {info && <p className="page-info">{info}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

export function Hint({ children }) {
  return <div className="hint"><Icon name="Lightbulb" size={15} /><div>{children}</div></div>
}
export function Sim({ children = 'Simulated' }) {
  return <span className="sim" title="This is simulated for the demo — no real hospital system is connected."><Icon name="Monitor" size={11} />{children}</span>
}

// Responsive table: desktop rows, mobile cards (via data-label)
export function Table({ cols, rows, onRow, empty, rowKey = (r) => r.id, rowClass }) {
  if (!rows.length) return empty || <Empty title="Nothing here" />
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>{cols.map((c) => <th key={c.key || c.label} style={c.w ? { width: c.w } : null}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className={`${onRow ? 'clickable' : ''} ${rowClass?.(r) || ''}`} onClick={onRow ? () => onRow(r) : undefined}
              tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => e.key === 'Enter' && onRow(r) : undefined}>
              {cols.map((c) => <td key={c.key || c.label} data-label={c.label} className={c.cls}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Mono({ children }) { return <span className="mono">{children}</span> }

// Patient identity banner (BR-03) — stays visible during patient-specific workflows
export function PatientBanner({ ip, compact, actions }) {
  const { s, nav } = useStore()
  const e = s.encounters.find((x) => x.ip === ip)
  if (!e) return null
  const p = patientOf(s, e.uhid)
  const st = stageOf(s, e)
  return (
    <div className={`pbanner ${compact ? 'compact' : ''}`}>
      <div className="pb-avatar" aria-hidden>{p.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
      <div className="pb-main">
        <div className="pb-name">
          <button className="linklike" onClick={() => nav('patient', { ip })}>{p.name}</button>
          <span className="pb-as">{p.age} y · {p.sex === 'M' ? 'Male' : 'Female'}</span>
          <Badge>{st.label}</Badge>
        </div>
        <div className="pb-ids">
          <span><em>UHID</em><Mono>{e.uhid}</Mono></span>
          <span><em>IP No.</em><Mono>{e.ip}</Mono></span>
          <span><em>Dept</em>{e.dept}</span>
          {!compact && <span><em>Consultant</em>{e.consultant}</span>}
          <span><em>Admitted</em>{fmtDT(e.admitted).split(',')[0]}</span>
          <span><em>Discharged</em>{e.discharged ? fmtDT(e.discharged) : '— (admitted)'}</span>
        </div>
      </div>
      {actions && <div className="pb-actions">{actions}</div>}
    </div>
  )
}

// Live TAT chip computed against the simulated clock
export function Tat({ due, now, doneLabel }) {
  if (!due) return <span className="muted">{doneLabel || '—'}</span>
  const left = due - now
  const tone = left < 0 ? 'bad' : left < 2 * 3600000 ? 'warn' : 'ok'
  return (
    <span className={`tat tat-${tone}`} title={`Due ${fmtDT(due)}`}>
      <Icon name={left < 0 ? 'Siren' : 'Timer'} size={13} />
      {left < 0 ? `Overdue ${fmtDur(-left)}` : `${fmtDur(left)} left`}
    </span>
  )
}

export function Timeline({ items }) {
  if (!items.length) return <Empty icon="History" title="No events yet" />
  return (
    <ol className="timeline">
      {items.map((a) => (
        <li key={a.id}>
          <div className="tl-dot" data-role={a.role} />
          <div className="tl-body">
            <div className="tl-top"><strong>{a.action}</strong><time>{fmtDT(a.at)}</time></div>
            <div className="tl-meta"><Icon name="User" size={12} />{a.by}{a.ref && <><span className="sep">·</span><Mono>{a.ref}</Mono></>}</div>
            {a.remarks && <div className="tl-rem">{a.remarks}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Search name, UHID, IP number…', autoFocus }) {
  return (
    <div className="searchbox">
      <Icon name="Search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} />
      {value && <button className="icon-btn" onClick={() => onChange('')} aria-label="Clear search"><Icon name="X" size={14} /></button>}
    </div>
  )
}

export function useLocal(initial) { return useState(initial) }

export function Steps({ steps, current }) {
  return (
    <ol className="lifecycle">
      {steps.map((st, i) => (
        <li key={st} className={i < current ? 'done' : i === current ? 'now' : ''}>
          <span className="lc-dot">{i < current ? <Icon name="Check" size={12} /> : i + 1}</span>
          <span className="lc-label">{st}</span>
        </li>
      ))}
    </ol>
  )
}

export function Card({ title, icon, actions, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && <header className="card-head"><h3>{icon && <Icon name={icon} size={16} />}{title}</h3>{actions}</header>}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  )
}

export function MobileBack() {
  const { s, nav } = useStore()
  const tab = s.route?.params?.tab
  return <button className="mobile-back" onClick={() => nav(s.route.page, tab ? { tab } : {})}><Icon name="ArrowLeft" size={15} /> Back to list</button>
}
