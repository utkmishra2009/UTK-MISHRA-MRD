import { useState } from 'react'
import { useStore } from '../store'
import { WF, WARDS, currentUser } from '../data/catalog'
import { patientOf, encOf, statusOf, custodyOf, digitalOf, ownerOf, searchRecords, fmtShort } from '../lib/logic'
import { PageHead, Badge, Mono, Empty, PatientBanner, Button, SearchBox, Hint, MobileBack, Pending } from '../components/ui'
import { LifecyclePanel } from '../components/Lifecycle'

export default function Tracking() {
  const { s, nav } = useStore()
  const params = s.route.params || {}
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [ward, setWard] = useState('')
  const [custody, setCustody] = useState('')
  const name = (u) => patientOf(s, u)?.name || ''
  const base = q.trim() ? searchRecords(s, q) : s.encounters.filter((e) => !e.archive)
  const custodyKind = (e) => { const c = custodyOf(s, e).label; return c.startsWith('With') || c.startsWith('Returned') ? 'ward' : c.startsWith('In transit') ? 'transit' : c.startsWith('Issued') ? 'issued' : statusOf(e) === WF.ARCHIVED ? 'archive' : 'mrd' }
  const rows = base
    .filter((e) => (!st || statusOf(e) === st) && (!ward || e.ward === ward) && (!custody || custodyKind(e) === custody))
    .sort((a, b) => (b.statusAt || 0) - (a.statusAt || 0))
    .slice(0, 150)
  const sel = params.ip && encOf(s, params.ip)
  // Other admissions of the same patient are listed separately — never merged
  const siblings = sel ? s.encounters.filter((x) => x.uhid === sel.uhid && x.ip !== sel.ip) : []

  return (
    <div className="page">
      <PageHead kicker="One record, one history" title="Record Tracking" info="Find any admission and see exactly where it is: workflow status, physical file, digital copy, who must act next, and every action taken — replacing the movement register." />
      <div className={`split split-track ${sel ? 'has-detail' : ''}`}>
        <div className="split-list">
          <SearchBox value={q} onChange={setQ} placeholder="Name, UHID, IP number, file or handover ref" />
          <div className="filters stack">
            <select value={st} onChange={(e) => setSt(e.target.value)} aria-label="Workflow status"><option value="">Any workflow status</option>{Object.values(WF).map((x) => <option key={x}>{x}</option>)}</select>
            <select value={custody} onChange={(e) => setCustody(e.target.value)} aria-label="Physical file"><option value="">Physical file: anywhere</option><option value="ward">With ward</option><option value="transit">In transit</option><option value="mrd">In MRD (processing)</option><option value="archive">Archived</option><option value="issued">Issued to department</option></select>
            <select value={ward} onChange={(e) => setWard(e.target.value)} aria-label="Ward"><option value="">All wards</option>{WARDS.map((w) => <option key={w}>{w}</option>)}</select>
          </div>
          <ul className="trk-list">
            {rows.map((e) => {
              const ow = ownerOf(s, e)
              const dg = digitalOf(s, e)
              return (
                <li key={e.ip}>
                  <button className={sel?.ip === e.ip ? 'on' : ''} onClick={() => nav('tracking', { ip: e.ip })}>
                    <span className="trk-top"><strong>{name(e.uhid)}</strong><Badge>{statusOf(e)}</Badge></span>
                    <small><Mono>{e.uhid}</Mono> · <Mono>{e.ip}</Mono> · {e.ward}</small>
                    <span className="trk-meta">
                      <span title="Physical file"><b>File:</b> {custodyOf(s, e).label}</span>
                      <span title="Digital copy"><b>Digital:</b> {dg.available}/{dg.total}</span>
                      {statusOf(e) !== WF.ARCHIVED && statusOf(e) !== WF.ADMITTED && <span><b>Next:</b> {ow.action} · <Pending since={ow.since} now={s.now} /></span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {!rows.length && <Empty icon="Search" title="No matching records">Check the UHID or spelling.</Empty>}
          {!q && <p className="small muted">Showing current working records. Type to also search {s.encounters.filter((e) => e.archive).length} archived files.</p>}
        </div>
        <div className="split-detail"><MobileBack />
          {sel ? (
            <div className="detail">
              <PatientBanner ip={sel.ip} actions={ow(s, sel).page !== 'tracking' && <Button size="sm" variant="primary" icon="ArrowRight" onClick={() => nav(ow(s, sel).page, ow(s, sel).params)}>{ow(s, sel).action}</Button>} />
              {siblings.length > 0 && <Hint>This patient has {siblings.length} other admission(s), tracked separately: {siblings.map((x) => <button key={x.ip} className="linklike" onClick={() => nav('tracking', { ip: x.ip })}>{x.ip} ({fmtShort(x.admitted).slice(0, 6)})</button>)}</Hint>}
              <LifecyclePanel key={sel.ip} ip={sel.ip} />
            </div>
          ) : <Empty icon="Route" title="Select a record">Pick any admission on the left to see its complete lifecycle.</Empty>}
        </div>
      </div>
    </div>
  )
}

const ow = (s, e) => {
  const o = ownerOf(s, e)
  const role = currentUser(s).role
  return { ...o, page: role === 'supervisor' || o.page === 'tracking' ? o.page : o.page }
}
