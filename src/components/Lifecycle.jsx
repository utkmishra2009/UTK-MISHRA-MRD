import { useState } from 'react'
import { useStore } from '../store'
import { LIFECYCLE, WF, WF_STEP, docType, defCat, locLabel } from '../data/catalog'
import { statusOf, custodyOf, digitalOf, ownerOf, defsOf, docsOf, fmtDT, fmtShort, defAssigneeLabel, patientOf, encOf } from '../lib/logic'
import { Badge, Button, Icon, Mono, Empty, Tabs, Timeline, Pending, Tat, PatientBanner, Drawer, Table } from './ui'
import { DocViewer } from './DocPage'

// Four separate answers: where is the record in the workflow, where is the paper, is it digital, who acts next
export function StatusDims({ ip }) {
  const { s } = useStore()
  const e = encOf(s, ip)
  if (!e) return null
  const st = statusOf(e)
  const cu = custodyOf(s, e)
  const dg = digitalOf(s, e)
  const ow = ownerOf(s, e)
  return (
    <div className="dims">
      <div className="dim">
        <small><Icon name="Workflow" size={13} /> Workflow status</small>
        <Badge>{st}</Badge>
        <span className="dim-sub">since {fmtShort(e.statusAt)}</span>
      </div>
      <div className="dim">
        <small><Icon name="FolderOpen" size={13} /> Physical file</small>
        <strong className={`t-${cu.tone}`}>{cu.label}</strong>
        <span className="dim-sub">{cu.detail}</span>
      </div>
      <div className="dim">
        <small><Icon name="FileScan" size={13} /> Digital copy</small>
        <strong>{dg.available}/{dg.total} documents</strong>
        <div className="meter" aria-hidden><span style={{ width: `${dg.total ? (dg.available / dg.total) * 100 : 0}%` }} /></div>
        <span className="dim-sub">{dg.label}{dg.pending ? ` · ${dg.pending} scan pending` : ''}</span>
      </div>
      <div className="dim">
        <small><Icon name="User" size={13} /> Next action · owner</small>
        <strong>{ow.action}</strong>
        <span className="dim-sub">{ow.team}{ow.names.length ? ` (${ow.names.join(', ')})` : ''}</span>
        {st !== WF.ARCHIVED && <span className="dim-sub"><Pending since={ow.since} now={s.now} /> {ow.due && <Tat due={ow.due} now={s.now} />}</span>}
      </div>
    </div>
  )
}

// Visual progress tracker; loops (returns, rejected corrections) are counted from the record history
export function LifecycleTracker({ ip }) {
  const { s } = useStore()
  const e = encOf(s, ip)
  const st = statusOf(e)
  const cur = WF_STEP[st] ?? -1
  const hist = s.audit.filter((a) => a.ip === ip)
  const returns = hist.filter((a) => a.to === WF.RETURNED).length
  const defs = defsOf(s, ip)
  const rejected = defs.reduce((n, d) => n + d.corrections.filter((c) => c.rejected).length, 0)
  const reviewed = !!e.review?.completedAt || cur > 3
  const hadDefs = defs.length > 0
  // A step is done when the record has passed it; "Corrections" & "Verified" are skipped (not failed) when no deficiencies were raised
  const state = (i) => {
    if (st === WF.ARCHIVED) return i === 4 || i === 5 ? (hadDefs ? 'done' : 'skip') : 'done'
    if (st === WF.RETURNED && i === 1) return 'loop'
    if (i === 3) return reviewed ? 'done' : cur === 2 ? 'now' : ''
    if (i === 4) return st === WF.CORRECTIONS ? 'now' : cur > 4 ? (hadDefs ? 'done' : 'skip') : ''
    if (i === 5) return st === WF.AWAIT_VERIFY ? 'now' : cur > 5 ? (hadDefs ? 'done' : 'skip') : ''
    if (i < cur || (i === 2 && cur >= 2)) return i === 2 && cur === 2 ? 'done' : 'done'
    if (i === cur) return 'now'
    if (i === 6 && st === WF.READY) return 'now'
    return ''
  }
  return (
    <div className="tracker-wrap">
      <ol className="tracker">
        {LIFECYCLE.map((l, i) => {
          const k = state(i)
          return (
            <li key={l} className={k}>
              <span className="tk-dot">{k === 'done' ? <Icon name="Check" size={12} /> : k === 'skip' ? <Icon name="Minus" size={12} /> : k === 'loop' ? <Icon name="Undo2" size={12} /> : i + 1}</span>
              <span className="tk-l">{l}</span>
              {i === 1 && returns > 0 && <span className="tk-loop">returned ×{returns}</span>}
              {i === 4 && hadDefs && <span className="tk-loop">{defs.length} issue{defs.length > 1 ? 's' : ''}</span>}
              {i === 5 && rejected > 0 && <span className="tk-loop bad">{rejected} rejected</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function RecordHistory({ ip }) {
  const { s } = useStore()
  const [f, setF] = useState('all')
  const all = s.audit.filter((a) => a.ip === ip).slice().reverse()
  const filters = {
    all: () => true,
    status: (a) => a.to && a.from !== a.to,
    defs: (a) => /deficien|correction/i.test(a.action),
    docs: (a) => /scan|upload|document|QC|intake/i.test(a.action),
  }
  const items = all.filter(filters[f])
  return (
    <div className="history">
      <div className="chips" role="group" aria-label="Filter history">
        {[['all', 'Everything'], ['status', 'Status changes'], ['defs', 'Deficiencies'], ['docs', 'Documents']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
      </div>
      <Timeline items={items} />
    </div>
  )
}

// One deficiency with its own complete history (never merged with others on the same encounter)
export function DefHistory({ d }) {
  return (
    <ol className="timeline compact">
      {d.history.slice().reverse().map((h, i) => (
        <li key={i}>
          <div className="tl-dot" />
          <div className="tl-body">
            <div className="tl-top"><strong>{h.action}</strong><time>{fmtDT(h.at)}</time></div>
            <div className="tl-meta"><Icon name="User" size={12} />{h.by}</div>
            {h.to && <div className="tl-status">{h.from ? <Badge dot={false}>{h.from}</Badge> : <span className="muted small">new</span>}<Icon name="ArrowRight" size={12} /><Badge>{h.to}</Badge></div>}
            {h.remarks && <div className="tl-rem">{h.remarks}</div>}
            {h.assigned && <div className="tl-assign"><Icon name="CornerDownRight" size={12} />Assigned: {h.assigned}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function DefSummary({ d, actions }) {
  const { s } = useStore()
  const c = defCat(d.category)
  return (
    <div className={`defcard st-${d.status.replace(/\s/g, '-').toLowerCase()}`}>
      <div className="defcard-top">
        <span className="defcard-ic"><Icon name={c.icon} size={16} /></span>
        <div className="defcard-main">
          <strong>{d.title}</strong>
          <small>{c.label}{d.docType && ` · ${docType(d.docType).name}`} · <Mono>{d.id}</Mono></small>
        </div>
        <Badge>{d.status}</Badge>
        {d.reopened > 0 && <Badge tone="bad">Reopened ×{d.reopened}</Badge>}
      </div>
      {d.description && <p className="defcard-desc">{d.description}</p>}
      <div className="defcard-meta">
        <span><Icon name="User" size={12} /> {defAssigneeLabel(d)}</span>
        <span><Icon name="Flag" size={12} /> Raised {fmtShort(d.raisedAt)} by {d.raisedBy}</span>
        {d.status === 'Open' && <Tat due={d.dueAt} now={s.now} />}
        {d.status === 'Correction Submitted' && <span><Icon name="Clock" size={12} /> Submitted <Pending since={d.statusAt} now={s.now} /> ago</span>}
      </div>
      {d.corrections.length > 0 && (
        <div className="corrections">
          {d.corrections.map((c2, i) => (
            <div key={i} className={`corr ${c2.rejected ? 'rej' : ''}`}>
              <small>Correction {i + 1} · {c2.by} · {fmtShort(c2.at)}{c2.method === 'esign' && ' · e-signed (simulated)'}{c2.docId && ' · corrected document attached'}</small>
              <span>{c2.note}</span>
              {c2.rejected && <em><Icon name="CircleX" size={12} /> Rejected by {c2.rejected.by}: {c2.rejected.reason}</em>}
            </div>
          ))}
        </div>
      )}
      {actions && <div className="row-end wrap">{actions}</div>}
    </div>
  )
}

export function RecordDocs({ ip }) {
  const { s } = useStore()
  const e = encOf(s, ip)
  const [doc, setDoc] = useState(null)
  const docs = docsOf(s, ip)
  return (
    <>
      <Table rows={docs} onRow={(d) => d.pages.length && setDoc(d)} cols={[
        { label: 'Document', render: (d) => <span><strong>{docType(d.type).name}</strong><small className="block muted">{d.folder || docType(d.type).folder}{d.tags?.length ? ` · ${d.tags.join(', ')}` : ''}</small></span> },
        { label: 'Source', render: (d) => <Badge tone="info" dot={false}>{d.kind === 'electronic' ? `${d.source} (HMIS)` : d.uploaded ? 'Upload' : 'Scanned'}</Badge> },
        { label: 'Digital', render: (d) => <Badge>{d.status === 'Filed' ? 'Available' : d.status === 'Approved' ? 'Available' : d.status}</Badge> },
        { label: 'Pages', render: (d) => d.pages.length || '—' },
        { label: 'Added', render: (d) => <small>{fmtShort(d.receivedAt)}{d.by && ` · ${d.by}`}</small> },
      ]} empty={<Empty icon="Files" title="No documents yet" />} />
      <Drawer open={!!doc} onClose={() => setDoc(null)} title={doc && docType(doc.type).name} subtitle={doc && `${doc.id} · ${doc.status}`} wide>
        {doc && <DocViewer doc={doc} patient={patientOf(s, e.uhid)} enc={e} markOf={(pg) => pg.mark} />}
      </Drawer>
    </>
  )
}

export function HandoverHistory({ ip }) {
  const { s } = useStore()
  const e = encOf(s, ip)
  const list = [...(e.handovers || []), ...(e.handover ? [e.handover] : [])].reverse()
  if (!list.length) return <Empty icon="ClipboardList" title="Not handed over yet" />
  return (
    <div className="ho-list">
      {list.map((h) => (
        <div key={h.ref} className="ho">
          <div className="ho-top"><Mono>{h.ref}</Mono><Badge dot={false}>v{h.version || 1}</Badge><Badge>{h.status === 'Submitted' ? 'Sent' : h.status}</Badge></div>
          <dl className="dl dl-tight">
            <dt>Sent</dt><dd>{fmtDT(h.at)} · {h.by} · via {h.carrier}</dd>
            <dt>Physical docs</dt><dd>{h.items.map((i) => `${docType(i.type).name} (${i.pages}p)`).join(', ')}</dd>
            {h.missing?.length > 0 && <><dt>Missing</dt><dd>{h.missing.map((m) => docType(m).name).join(', ')}</dd></>}
            {h.exception && <><dt>Exception</dt><dd>{h.exception.reason} · authorized by {h.exception.authorizedBy}</dd></>}
            {h.receivedAt && <><dt>Received</dt><dd>{fmtDT(h.receivedAt)} · {h.receivedBy}{h.check?.notReceived?.length ? ` · not received: ${h.check.notReceived.map((t) => docType(t).name).join(', ')}` : ''}</dd></>}
            {h.returnedAt && <><dt>Returned</dt><dd>{fmtDT(h.returnedAt)} · {h.returnedBy} · {h.returnReason}</dd></>}
          </dl>
        </div>
      ))}
    </div>
  )
}

// Full lifecycle view for one encounter — used by the drawer and the Record Tracking screen
export function LifecyclePanel({ ip, initialTab = 'history' }) {
  const { s } = useStore()
  const [tab, setTab] = useState(initialTab)
  const e = encOf(s, ip)
  if (!e) return <Empty title="Record not found" />
  const defs = defsOf(s, ip)
  const f = s.files.find((x) => x.id === e.fileId)
  return (
    <div className="lifecycle-panel">
      <LifecycleTracker ip={ip} />
      <StatusDims ip={ip} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'history', label: 'Activity history', icon: 'History' },
        { id: 'defs', label: 'Deficiencies', icon: 'FileWarning', count: defs.length },
        { id: 'docs', label: 'Documents', icon: 'Files', count: docsOf(s, ip).length },
        { id: 'handovers', label: 'Handovers', icon: 'ClipboardList', count: (e.handovers?.length || 0) + (e.handover ? 1 : 0) },
        { id: 'custody', label: 'File custody', icon: 'FolderOpen' },
      ]} />
      {tab === 'history' && <RecordHistory ip={ip} />}
      {tab === 'defs' && (defs.length ? <div className="deflist">{defs.map((d) => <details key={d.id} className="defwrap" open={defs.length < 3}><summary><DefSummary d={d} /></summary><DefHistory d={d} /></details>)}</div> : <Empty icon="CircleCheck" title="No deficiencies raised" />)}
      {tab === 'docs' && <RecordDocs ip={ip} />}
      {tab === 'handovers' && <HandoverHistory ip={ip} />}
      {tab === 'custody' && (
        f ? <div className="custody">
          <dl className="dl"><dt>File</dt><dd><Mono>{f.id}</Mono> · vol. {f.volume}</dd><dt>Status</dt><dd><Badge>{f.status}</Badge></dd><dt>Custodian</dt><dd>{f.custodian || 'MRD'}</dd><dt>Archive position</dt><dd>{f.location ? locLabel(f.location) : 'Not yet archived'}</dd></dl>
          <ul className="hist">{f.history.slice().reverse().map((h, i) => <li key={i}>{fmtDT(h.at)} · {h.by} — {h.action}</li>)}</ul>
        </div> : <Empty icon="FolderOpen" title="No physical file yet">The ward has not sent a physical file for this admission.</Empty>
      )}
    </div>
  )
}

export function LifecycleDrawer() {
  const { trackIp, openTrack, nav } = useStore()
  if (!trackIp) return null
  return (
    <Drawer open onClose={() => openTrack(null)} wide title="Record lifecycle" subtitle="Workflow status, physical file, digital copy, ownership and full history"
      footer={<><Button onClick={() => openTrack(null)}>Close</Button><Button variant="primary" icon="Route" onClick={() => { openTrack(null); nav('tracking', { ip: trackIp }) }}>Open in Record Tracking</Button></>}>
      <PatientBanner ip={trackIp} compact />
      <LifecyclePanel ip={trackIp} />
    </Drawer>
  )
}
