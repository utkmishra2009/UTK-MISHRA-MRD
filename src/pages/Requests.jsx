import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { docType, roleById, currentUser } from '../data/catalog'
import { H, fileOf, fileStatus, fmtDT, fmtShort, patientOf, encOf, reqDue, reqTat, docsOf, searchRecords, toLocalInput, fromLocalInput } from '../lib/logic'
import { MobileBack } from '../components/ui'
import { PageHead, Table, Badge, Tat, Mono, Empty, PatientBanner, Card, Button, Field, Icon, Hint, SearchBox, Modal, Tabs, Sim } from '../components/ui'
import { DocViewer } from '../components/DocPage'
import { LocationTrail } from './Storage'

const PURPOSES = ['Follow-up OPD review', 'Readmission – previous history', 'Insurance / TPA claim query', 'Medico-legal / court requirement', 'Clinical audit / NABH', 'Research (approved)', 'Second-opinion case discussion']

function ReqHistory({ r }) {
  return <ol className="timeline compact">{r.history.slice().reverse().map((h, i) => <li key={i}><div className="tl-dot" /><div className="tl-body"><div className="tl-top"><strong>{h.action}</strong><time>{fmtDT(h.at)}</time></div><div className="tl-meta"><Icon name="User" size={12} />{h.by}</div>{h.note && <div className="tl-rem">{h.note}</div>}</div></li>)}</ol>
}

function ReqSummary({ r }) {
  const { s } = useStore()
  const tat = reqTat(s, r)
  return (
    <dl className="dl">
      <dt>Reference</dt><dd><Mono>{r.id}</Mono> <Badge>{r.status}</Badge></dd>
      <dt>Requested by</dt><dd>{r.requester} · {r.dept}</dd>
      <dt>What</dt><dd>{r.scope} · {r.mode}{r.scope === 'Document' && `: ${r.docIds.map((id) => docType(s.documents.find((d) => d.id === id)?.type).name).join(', ')}`}</dd>
      <dt>Purpose</dt><dd>{r.purpose}</dd>
      <dt>Urgency</dt><dd><Badge>{r.urgency}</Badge>{r.requiredBy && <span className="muted"> · required by {fmtDT(r.requiredBy)}</span>}</dd>
      <dt>Submitted</dt><dd>{fmtDT(r.createdAt)}</dd>
      <dt>{tat?.label === 'Return' ? 'Return due' : 'Fulfilment due'}</dt><dd>{tat ? <><Tat due={tat.due} now={s.now} /> <span className="muted">({fmtDT(tat.due)})</span></> : <span className="muted">{fmtDT(r.dueAt)} (TAT {Math.round((r.dueAt - r.createdAt) / H * 10) / 10} h)</span>}</dd>
      {r.holdReason && r.status === 'On Hold' && <><dt>On hold</dt><dd>{r.holdReason}</dd></>}
      {r.discrepancy && <><dt>Discrepancy</dt><dd><Badge tone={r.discrepancy.status === 'Resolved' ? 'ok' : 'bad'}>{r.discrepancy.kind} · {r.discrepancy.status}</Badge> {r.discrepancy.remarks}{r.discrepancy.resolution && <div className="small">Resolution: {r.discrepancy.resolution}</div>}</dd></>}
    </dl>
  )
}

// ───────────────────────── Requesting department
export function MyRequests() {
  const { s, nav } = useStore()
  const params = s.route.params || {}
  const me = currentUser(s).name
  const mine = s.requests.filter((r) => r.requester === me).sort((a, b) => b.createdAt - a.createdAt)
  const [tab, setTab] = useState('open')
  const open = mine.filter((r) => !['Closed', 'Completed', 'Rejected', 'Cancelled'].includes(r.status))
  const rows = tab === 'open' ? open : mine.filter((r) => !open.includes(r))
  let sel = params.req && s.requests.find((r) => r.id === params.req)
  if (!sel && params.ip) sel = mine.find((r) => r.ip === params.ip)
  const creating = params.new || params.newFor
  const name = (u) => patientOf(s, u)?.name
  return (
    <div className="page">
      <PageHead kicker={`${currentUser(s).name} · ${currentUser(s).title}`} title="My record requests" info="Request a complete patient file or individual documents, accept them when they arrive, and return physical files to MRD.">
        <Button variant="primary" icon="Plus" onClick={() => nav('myrequests', { new: 1 })}>New request</Button>
      </PageHead>
      <div className={`split ${sel || creating ? 'has-detail' : ''}`}>
        <div className="split-list">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'open', label: 'Open', count: open.length }, { id: 'done', label: 'Closed', count: mine.length - open.length }]} />
          <Table rows={rows} onRow={(r) => nav('myrequests', { req: r.id })} rowClass={(r) => (r.id === sel?.id ? 'sel' : '')}
            cols={[
              { label: 'Request', render: (r) => <div className="cell-pt"><strong>{name(r.uhid)}</strong><small><Mono>{r.id}</Mono> · {r.scope} · {r.mode}</small></div> },
              { label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              { label: 'Due', render: (r) => { const t = reqTat(s, r); return t ? <Tat due={t.due} now={s.now} /> : <span className="muted small">—</span> } },
            ]} empty={<Empty icon="FolderSearch" title="No requests" action={<Button size="sm" onClick={() => nav('myrequests', { new: 1 })}>Create one</Button>} />} />
        </div>
        <div className="split-detail"><MobileBack />
          {creating ? <NewRequest key={params.newFor || 'new'} presetIp={params.newFor} /> : sel ? <RequesterDetail key={sel.id} r={sel} /> : <Empty icon="Send" title="Select a request" />}
        </div>
      </div>
    </div>
  )
}

function NewRequest({ presetIp }) {
  const { s, run, nav } = useStore()
  const [q, setQ] = useState('')
  const [ip, setIp] = useState(presetIp || '')
  const [scope, setScope] = useState('Complete file')
  const [mode, setMode] = useState('Physical')
  const [docIds, setDocIds] = useState([])
  const [purpose, setPurpose] = useState(PURPOSES[0])
  const [detail, setDetail] = useState('')
  const [urgency, setUrgency] = useState('Routine')
  const [reqBy, setReqBy] = useState(toLocalInput(s.now + 24 * H))
  const [done, setDone] = useState(null)
  const res = searchRecords(s, q).filter((e) => e.discharged).slice(0, 8)
  const e = ip && encOf(s, ip)
  const f = e && fileOf(s, e.fileId)
  const docs = e ? docsOf(s, ip).filter((d) => ['Filed', 'Approved'].includes(d.status)) : []
  const unauth = e ? docsOf(s, ip).filter((d) => !['Filed', 'Approved'].includes(d.status)).length : 0
  useEffect(() => { if (scope === 'Document') setMode('Electronic') }, [scope])
  const due = reqDue(s.config, urgency, mode, s.now)
  const submit = () => {
    const r = run('CREATE_REQ', { ip, scope, mode, docIds: scope === 'Document' ? docIds : [], purpose: detail ? `${purpose} – ${detail}` : purpose, urgency, requiredBy: fromLocalInput(reqBy) })
    if (r.ok) setDone(r.state.lastRef)
  }
  return (
    <div className="detail">
      <Card title="New record request" icon="Send" actions={<Button size="sm" variant="ghost" icon="X" aria-label="Close" onClick={() => nav('myrequests', {})} />}>
        {!e ? (
          <>
            <Field label="1 · Find the patient" hint="Search by name (min. 3 letters), UHID or IP number">
              <SearchBox value={q} onChange={setQ} autoFocus />
            </Field>
            {q.length >= 3 && !res.length && <p className="small muted">No matching records. Check the UHID or spelling.</p>}
            <ul className="pick">{res.map((x) => <li key={x.ip}><button onClick={() => setIp(x.ip)}><strong>{patientOf(s, x.uhid).name}</strong><small><Mono>{x.uhid}</Mono> · <Mono>{x.ip}</Mono> · {x.dept} · discharged {fmtShort(x.discharged)}</small></button></li>)}</ul>
          </>
        ) : (
          <>
            <PatientBanner ip={ip} compact actions={!presetIp && <Button size="sm" variant="ghost" onClick={() => setIp('')}>Change</Button>} />
            <div className="seg-row">
              <Field label="2 · What do you need?"><div className="seg">{['Complete file', 'Document'].map((x) => <button key={x} className={scope === x ? 'on' : ''} onClick={() => setScope(x)}>{x === 'Document' ? 'Individual document(s)' : x}</button>)}</div></Field>
              <Field label="Format"><div className="seg">{['Physical', 'Electronic'].map((x) => <button key={x} className={mode === x ? 'on' : ''} disabled={scope === 'Document' && x === 'Physical'} onClick={() => setMode(x)}>{x === 'Physical' ? 'Physical file' : 'Electronic access'}</button>)}</div></Field>
            </div>
            {mode === 'Physical' && f && (
              <div className={`callout ${fileStatus(s, f) === 'Available' ? 'ok' : 'warn'}`}>
                <Icon name="FolderOpen" size={16} />
                <div>Physical file <Mono>{f.id}</Mono> is <b>{fileStatus(s, f)}</b>{f.status === 'Issued' && <> — currently with {f.custodian}, due back {fmtDT(f.issue?.expectedReturn)}. Your request will wait in the queue.</>}{!f.location && f.status !== 'Issued' && <> — still being processed in MRD.</>}</div>
              </div>
            )}
            {scope === 'Document' && (
              <Field label="Select documents" hint={unauth ? `${unauth} document(s) not yet authorised/QC-passed are hidden – only authorised documents can be released.` : 'Only authorised documents are listed.'}>
                <ul className="checks">{docs.map((d) => <li key={d.id}><label><input type="checkbox" checked={docIds.includes(d.id)} onChange={() => setDocIds(docIds.includes(d.id) ? docIds.filter((x) => x !== d.id) : [...docIds, d.id])} /><span>{docType(d.type).name}</span><Badge tone="mute" dot={false}>{d.folder || docType(d.type).folder}</Badge><small className="muted">{fmtShort(d.docDate)}</small></label></li>)}</ul>
              </Field>
            )}
            <div className="form-grid">
              <Field label="Purpose" required><select value={purpose} onChange={(ev) => setPurpose(ev.target.value)}>{PURPOSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Urgency"><select value={urgency} onChange={(ev) => setUrgency(ev.target.value)}><option>Routine</option><option>Urgent</option><option>Emergency</option></select></Field>
              <Field label="Details"><input value={detail} onChange={(ev) => setDetail(ev.target.value)} placeholder="Optional note for MRD" /></Field>
              <Field label="Required by"><input type="datetime-local" value={reqBy} onChange={(ev) => setReqBy(ev.target.value)} /></Field>
            </div>
            <div className="callout"><Icon name="Timer" size={16} /><div>Configured TAT for <b>{urgency} · {mode}</b>: {s.config.tat.request[urgency][mode]} h → MRD should fulfil by <b>{fmtDT(due)}</b>.</div></div>
            <div className="row-end"><Button variant="primary" icon="Send" onClick={submit}>Submit request</Button></div>
          </>
        )}
      </Card>
      <Modal open={!!done} onClose={() => { setDone(null); nav('myrequests', { req: done }) }} title="Request submitted" footer={<Button variant="primary" onClick={() => { const d = done; setDone(null); nav('myrequests', { req: d }) }}>View request</Button>}>
        <div className="success-big"><Icon name="CircleCheck" size={36} /><div><small>Request reference</small><strong className="mono">{done}</strong></div></div>
        <p>MRD’s Request Desk has been notified. You can track the status here.</p>
      </Modal>
    </div>
  )
}

function RequesterDetail({ r }) {
  const { s, run } = useStore()
  const [disc, setDisc] = useState(false)
  const [kind, setKind] = useState('Missing documents')
  const [rem, setRem] = useState('')
  const [view, setView] = useState(false)
  const e = encOf(s, r.ip)
  const expired = r.release && s.now > r.release.expiresAt
  return (
    <div className="detail">
      <PatientBanner ip={r.ip} compact />
      <Card title="Request" icon="Send">
        <ReqSummary r={r} />
        {r.status === 'Issued' && <div className="callout"><Icon name="Package" size={16} /><div>The file was issued to <b>{r.issue?.to}</b> at {fmtShort(r.issue?.at)}. Check it and confirm receipt.</div></div>}
        <div className="row-end wrap">
          {['Pending', 'On Hold'].includes(r.status) && <Button onClick={() => run('REQ_ACTION', { id: r.id, action: 'cancel' }, 'Request withdrawn')}>Withdraw</Button>}
          {r.status === 'Issued' && <><Button icon="FileWarning" onClick={() => setDisc(true)}>Report discrepancy</Button><Button variant="primary" icon="PackageCheck" onClick={() => run('REQ_ACTION', { id: r.id, action: 'accept', note: 'Received complete' }, 'Receipt accepted')}>Accept receipt</Button></>}
          {['Accepted', 'Discrepancy'].includes(r.status) && <>{r.status !== 'Discrepancy' && <Button icon="FileWarning" onClick={() => setDisc(true)}>Report discrepancy</Button>}<Button variant="primary" icon="Undo2" onClick={() => run('REQ_ACTION', { id: r.id, action: 'return', note: 'Returned via department runner' }, 'File sent back to MRD')}>Return file</Button></>}
          {r.status === 'Released' && <><Button icon="Eye" onClick={() => setView(true)} disabled={expired}>{expired ? 'Access expired' : 'Open documents'}</Button><Button variant="primary" icon="Check" onClick={() => run('REQ_ACTION', { id: r.id, action: 'viewed' }, 'Acknowledged')}>Mark as used</Button></>}
        </div>
      </Card>
      <Card title="Request history" icon="History"><ReqHistory r={r} /></Card>
      <Modal open={disc} onClose={() => setDisc(false)} title="Report a discrepancy" subtitle="This is escalated to the MRD supervisor immediately."
        footer={<><Button onClick={() => setDisc(false)}>Cancel</Button><Button variant="danger" onClick={() => { if (run('REQ_ACTION', { id: r.id, action: 'discrepancy', kind, remarks: rem }, 'Discrepancy reported & escalated').ok) setDisc(false) }}>Report & escalate</Button></>}>
        <Field label="Type"><select value={kind} onChange={(ev) => setKind(ev.target.value)}><option>Missing documents</option><option>Damaged file</option><option>Wrong patient file</option><option>Pages out of order</option></select></Field>
        <Field label="Details" required><textarea rows={3} value={rem} onChange={(ev) => setRem(ev.target.value)} placeholder="e.g. Consent forms for the angiography are not in the file" /></Field>
      </Modal>
      <Modal open={view} onClose={() => setView(false)} wide title="Released documents" subtitle={`Watermarked · access expires ${fmtDT(r.release?.expiresAt)}`}>
        <Sim>Controlled electronic release</Sim>
        {r.docIds.concat(r.scope === 'Complete file' ? docsOf(s, r.ip).filter((d) => ['Filed', 'Approved'].includes(d.status)).map((d) => d.id) : []).slice(0, 6).map((id) => {
          const d = s.documents.find((x) => x.id === id)
          return d && <div key={id} className="wm-wrap"><h4>{docType(d.type).name}</h4><DocViewer doc={d} patient={patientOf(s, d.uhid)} enc={e} /><div className="wm" aria-hidden>{r.release?.watermark} · {fmtShort(s.now)}</div></div>
        })}
      </Modal>
    </div>
  )
}

// ───────────────────────── MRD Request Desk
export function RequestDesk() {
  const { s, nav } = useStore()
  const params = s.route.params || {}
  const [tab, setTab] = useState(params.tab || 'pending')
  useEffect(() => { if (params.tab) setTab(params.tab) }, [params.tab])
  const [q, setQ] = useState('')
  const name = (u) => patientOf(s, u)?.name || ''
  const all = s.requests.filter((r) => !q || [name(r.uhid), r.uhid, r.ip, r.id, r.dept].some((v) => v.toLowerCase().includes(q.toLowerCase())))
  const groups = {
    pending: all.filter((r) => ['Pending', 'On Hold'].includes(r.status)).sort((a, b) => a.dueAt - b.dueAt),
    issued: all.filter((r) => ['Issued', 'Accepted', 'Discrepancy', 'Released'].includes(r.status)),
    returns: all.filter((r) => r.status === 'Return Submitted'),
    closed: all.filter((r) => ['Closed', 'Completed', 'Rejected', 'Cancelled'].includes(r.status)).sort((a, b) => b.createdAt - a.createdAt),
  }
  let sel = params.req && s.requests.find((r) => r.id === params.req)
  if (!sel && params.ip) sel = s.requests.filter((r) => r.ip === params.ip).sort((a, b) => b.createdAt - a.createdAt)[0]
  return (
    <div className="page">
      <PageHead kicker="Retrieval & release" title="Request desk" info="Fulfil, hold or reject requests within TAT; issue physical files with a return date; release electronic documents with time-limited access; inspect returned files." />
      <Tabs value={tab} onChange={(t) => { setTab(t); nav('desk', { tab: t }) }} tabs={[
        { id: 'pending', label: 'To fulfil', icon: 'Inbox', count: groups.pending.length },
        { id: 'issued', label: 'Out with departments', icon: 'Truck', count: groups.issued.length },
        { id: 'returns', label: 'Returns to inspect', icon: 'Undo2', count: groups.returns.length },
        { id: 'closed', label: 'Closed', icon: 'Archive', count: groups.closed.length },
      ]} />
      <div className={`split ${sel ? 'has-detail' : ''}`}>
        <div className="split-list">
          <SearchBox value={q} onChange={setQ} placeholder="Search patient, request ref, department" />
          <Table rows={groups[tab]} onRow={(r) => nav('desk', { req: r.id, tab })} rowClass={(r) => (r.id === sel?.id ? 'sel' : '')}
            cols={[
              { label: 'Request', render: (r) => <div className="cell-pt"><strong>{name(r.uhid)}</strong><small><Mono>{r.id}</Mono> · {r.dept}</small></div> },
              { label: 'Type', render: (r) => <span>{r.mode}<small className="block muted">{r.scope}</small></span> },
              { label: 'Status', render: (r) => <span><Badge>{r.status}</Badge>{r.urgency !== 'Routine' && tab === 'pending' && <Badge>{r.urgency}</Badge>}</span> },
              { label: 'TAT', render: (r) => { const t = reqTat(s, r); return t ? <Tat due={t.due} now={s.now} /> : <span className="muted small">{fmtShort(r.createdAt)}</span> } },
            ]} empty={<Empty icon="CircleCheck" title="Nothing here" />} />
        </div>
        <div className="split-detail"><MobileBack />{sel ? <DeskDetail key={sel.id + sel.status} r={sel} /> : <Empty icon="Send" title="Select a request" />}</div>
      </div>
    </div>
  )
}

function DeskDetail({ r }) {
  const { s, run } = useStore()
  const e = encOf(s, r.ip)
  const f = fileOf(s, e?.fileId)
  const fst = fileStatus(s, f)
  const [modal, setModal] = useState(null)
  const [to, setTo] = useState(r.requester)
  const [hrs, setHrs] = useState(r.mode === 'Physical' ? s.config.tat.returnPeriod : s.config.tat.accessWindow)
  const [reason, setReason] = useState('')
  const [checks, setChecks] = useState({ pages: false, docs: false, damage: false })
  const [notes, setNotes] = useState('')
  const allOk = checks.pages && checks.docs && checks.damage
  const authDocs = docsOf(s, r.ip).filter((d) => ['Filed', 'Approved'].includes(d.status))
  const reqDocs = r.scope === 'Document' ? r.docIds : authDocs.map((d) => d.id)
  const excluded = r.scope === 'Document' ? r.docIds.filter((id) => !authDocs.some((d) => d.id === id)).length : docsOf(s, r.ip).length - authDocs.length
  const close = () => setModal(null)
  return (
    <div className="detail">
      <PatientBanner ip={r.ip} compact />
      <Card title="Request" icon="Send"><ReqSummary r={r} /></Card>
      {r.mode === 'Physical' && f && (
        <Card title="Where is the file?" icon="MapPin">
          <LocationTrail loc={f.location} status={fst} />
          <p className="small muted">Custodian: {f.custodian || 'MRD'}{f.issue && ` · issued ${fmtShort(f.issue.at)} · return by ${fmtDT(f.issue.expectedReturn)}`}</p>
          {['Pending', 'On Hold'].includes(r.status) && f.status !== 'Available' && <div className="callout warn"><Icon name="TriangleAlert" size={16} /><div>The file cannot be issued while it is <b>{fst}</b>. Hold the request or wait for its return.</div></div>}
        </Card>
      )}
      {r.mode === 'Electronic' && ['Pending', 'On Hold'].includes(r.status) && (
        <Card title="Documents to release" icon="Files">
          <ul className="checks">{reqDocs.map((id) => { const d = s.documents.find((x) => x.id === id); return d && <li key={id}><Icon name="FileText" size={14} /><span>{docType(d.type).name}</span><Badge tone="ok" dot={false}>Authorised</Badge></li> })}</ul>
          {excluded > 0 && <p className="small t-warn">Only authorised documents can be released. {excluded} item(s) excluded.</p>}
        </Card>
      )}
      {r.status === 'Return Submitted' && (
        <Card title="Return inspection" icon="ListChecks">
          <LocationTrail loc={f?.location} />
          <div className="qa col">
            {[['pages', 'Page count matches the file inventory'], ['docs', 'All documents present (consents, summaries, charts)'], ['damage', 'No damage, loose or torn pages']].map(([k, l]) => <label key={k}><input type="checkbox" checked={checks[k]} onChange={(ev) => setChecks({ ...checks, [k]: ev.target.checked })} />{l}</label>)}
          </div>
          <Field label="Inspection notes" hint="Mandatory if something is wrong"><textarea rows={2} value={notes} onChange={(ev) => setNotes(ev.target.value)} /></Field>
          <div className="row-end">
            <Button variant="danger" icon="FileWarning" onClick={() => run('REQ_ACTION', { id: r.id, action: 'inspect', ok: false, notes }, 'Issue recorded – supervisor alerted')}>Flag issue</Button>
            <Button variant="primary" icon="PackageCheck" disabled={!allOk} onClick={() => run('REQ_ACTION', { id: r.id, action: 'inspect', ok: true, notes: notes || 'All checks passed' }, 'File accepted and restored to its storage position')}>Accept & restore</Button>
          </div>
        </Card>
      )}
      {['Pending', 'On Hold'].includes(r.status) && (
        <div className="action-bar">
          {r.status === 'On Hold' ? <Button icon="Play" onClick={() => run('REQ_ACTION', { id: r.id, action: 'resume' }, 'Request resumed')}>Resume</Button> : <Button icon="Pause" onClick={() => { setReason(''); setModal('hold') }}>Hold</Button>}
          <Button icon="Ban" onClick={() => { setReason(''); setModal('reject') }}>Reject</Button>
          {r.mode === 'Physical'
            ? <Button variant="primary" icon="Truck" disabled={f?.status !== 'Available'} onClick={() => setModal('issue')}>Issue file</Button>
            : <Button variant="primary" icon="Send" onClick={() => setModal('release')}>Release access</Button>}
        </div>
      )}
      <Card title="Request history" icon="History"><ReqHistory r={r} /></Card>

      <Modal open={modal === 'issue'} onClose={close} title="Issue physical file" subtitle={f && `Pick from: ${f.location ? `${f.location.room === 'A' ? 'Room A' : 'Room B'} › Rack ${f.location.rack} › Shelf ${f.location.shelf} › Position ${f.location.pos}` : 'MRD'}`}
        footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => { if (run('REQ_ACTION', { id: r.id, action: 'issue', to, hours: hrs }, 'File issued – custodian & return date recorded').ok) close() }}>Confirm issue</Button></>}>
        <div className="form-grid">
          <Field label="Issuing user"><input readOnly value={`${currentUser(s).name} (MRD)`} /></Field>
          <Field label="Received by" required><input value={to} onChange={(ev) => setTo(ev.target.value)} /></Field>
          <Field label="Return period (hours)" hint={`Expected back ${fmtDT(s.now + hrs * H)}`}><input type="number" min="1" value={hrs} onChange={(ev) => setHrs(Number(ev.target.value))} /></Field>
          <Field label="Issue time"><input readOnly value={fmtDT(s.now)} /></Field>
        </div>
      </Modal>
      <Modal open={modal === 'release'} onClose={close} title="Release electronic access" subtitle="Time-limited, watermarked view — no physical movement."
        footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => { if (run('REQ_ACTION', { id: r.id, action: 'release', hours: hrs }, 'Access released').ok) close() }}>Release</Button></>}>
        <Field label="Access window (hours)" hint={`Expires ${fmtDT(s.now + hrs * H)}`}><input type="number" min="1" value={hrs} onChange={(ev) => setHrs(Number(ev.target.value))} /></Field>
        <p className="small muted">Watermark: “Released to {r.requester} · {r.id} · date/time”. <Sim /></p>
      </Modal>
      <Modal open={modal === 'hold' || modal === 'reject'} onClose={close} title={modal === 'hold' ? 'Place on hold' : 'Reject request'}
        footer={<><Button onClick={close}>Cancel</Button><Button variant={modal === 'reject' ? 'danger' : 'primary'} onClick={() => { if (run('REQ_ACTION', { id: r.id, action: modal, reason }, modal === 'hold' ? 'Request on hold' : 'Request rejected').ok) close() }}>{modal === 'hold' ? 'Hold' : 'Reject'}</Button></>}>
        <Field label="Reason" required><textarea rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder={modal === 'hold' ? 'e.g. File with Nephrology, due back tomorrow' : 'e.g. Purpose not covered by release policy'} /></Field>
      </Modal>
    </div>
  )
}
