import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { docType, DOC_TYPES, currentUser, WF, STORAGE, locKey } from '../data/catalog'
import { H, fmtShort, fmtDT, patientOf, statusOf, encOf, checklist, tasks, activeDefs, defsOf, digitalOf, fileOf, docsOf } from '../lib/logic'
import { PageHead, Tabs, Table, Badge, Mono, Empty, PatientBanner, Card, Button, Field, Modal, Drawer, Icon, Hint, Sim, SearchBox, TaskList, Pending } from '../components/ui'
import { StatusDims, DefSummary, RecordHistory } from '../components/Lifecycle'
import { RaiseDefModal, ScanCheck, CodingPanel, ReturnModal, EscalateModal } from '../components/ReviewKit'
import { PrintSlip } from '../components/PrintSlip'
import { QuickScan } from './Handover'
import { freeSlot, LocationTrail } from './Storage'

export default function Receiving() {
  const { s, nav, run } = useStore()
  const params = s.route.params || {}
  const all = tasks(s)
  const [tab, setTab] = useState(params.tab || 'receipt')
  useEffect(() => { if (params.tab) setTab(params.tab) }, [params.tab])
  const [q, setQ] = useState('')
  const name = (u) => patientOf(s, u)?.name || ''
  const match = (t) => !q || [name(t.uhid), t.uhid, t.ip, t.ward].some((v) => (v || '').toLowerCase().includes(q.toLowerCase()))
  const bucket = (b) => all.filter((t) => t.bucket === b && match(t)).sort((a, b2) => (a.due || 0) - (b2.due || 0))
  const returned = s.encounters.filter((e) => statusOf(e) === WF.RETURNED && (!q || name(e.uhid).toLowerCase().includes(q.toLowerCase())))
  const accepted = s.encounters.filter((e) => !e.archive && statusOf(e) === WF.ARCHIVED && e.acceptance?.at > s.now - 14 * 24 * H).sort((a, b) => b.acceptance.at - a.acceptance.at)
  const exc = s.documents.filter((d) => d.status === 'Exception')
  const elec = s.documents.filter((d) => d.kind === 'electronic' && d.status !== 'Exception').sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 30)
  const sel = params.ip && encOf(s, params.ip)
  const mode = sel && (params.open || { [WF.AWAIT_RECEIPT]: 'receive', [WF.AWAIT_REVIEW]: 'review', [WF.READY]: 'accept' }[statusOf(sel)])
  const close = () => nav('receiving', { tab })

  return (
    <div className="page">
      <PageHead kicker="MRD counter & review desk" title="MRD Receiving & QC" info="Acknowledge files as they arrive, review every document, raise deficiencies, and accept complete records into the archive. Each row has one next step.">
        <Button icon="Database" onClick={() => { if (run('SIM_ARRIVAL', {}, 'New electronic document received (simulated HMIS message)').ok) setTab('hmis') }}>Simulate HMIS document</Button>
      </PageHead>
      <div className="filters neo-in"><SearchBox value={q} onChange={setQ} placeholder="Patient name, UHID, IP number or ward" /></div>
      <Tabs value={tab} onChange={(t) => { setTab(t); nav('receiving', { tab: t }) }} tabs={[
        { id: 'receipt', label: 'Awaiting Receipt', icon: 'Package', count: bucket('receipt').length },
        { id: 'review', label: 'Awaiting Review', icon: 'FileCheck2', count: bucket('review').length },
        { id: 'verify', label: 'Awaiting Verification', icon: 'BadgeCheck', count: bucket('verify').length },
        { id: 'ready', label: 'Ready for Acceptance', icon: 'Archive', count: bucket('ready').length },
        { id: 'returned', label: 'Returned to ward', icon: 'Undo2', count: returned.length },
        { id: 'accepted', label: 'Accepted (14 days)', icon: 'CircleCheck', count: accepted.length },
        { id: 'hmis', label: 'HMIS intake', icon: 'Database', count: exc.length },
      ]} />
      {['receipt', 'review', 'verify', 'ready'].includes(tab) && <TaskList items={bucket(tab)} empty={<Empty icon="CircleCheck" title="Nothing waiting here" />} />}
      {tab === 'returned' && <Table rows={returned} rowKey={(e) => e.ip} cols={[
        { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.handover.ref}</Mono> · {e.ward}</small></div> },
        { label: 'Returned', render: (e) => <span>{fmtShort(e.handover.returnedAt)}<small className="block muted">{e.handover.returnedBy}</small></span> },
        { label: 'Reason', render: (e) => <small className="t-bad">{e.handover.returnReason}</small> },
        { label: 'Waiting on ward', render: (e) => <Pending since={e.statusAt} now={s.now} /> },
      ]} empty={<Empty icon="CircleCheck" title="No files returned to wards" />} />}
      {tab === 'accepted' && <Table rows={accepted} rowKey={(e) => e.ip} cols={[
        { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.ip}</Mono></small></div> },
        { label: 'Accepted', render: (e) => <span>{fmtShort(e.acceptance.at)}<small className="block muted">{e.acceptance.by}</small></span> },
        { label: 'Archive position', render: (e) => (e.acceptance.location ? <Mono>{locKey(e.acceptance.location)}</Mono> : '—') },
        { label: 'Digital', render: (e) => <small>{e.acceptance.digital}</small> },
      ]} empty={<Empty title="No records accepted in the last 14 days" />} />}
      {tab === 'hmis' && <>
        <Hint><Sim>Simulated integrations</Sim> Documents an EMR, LIS, RIS or HIS would send automatically. No real system is connected. Documents that cannot be matched are never guessed into a record.</Hint>
        <Exceptions docs={exc} />
        <h4 className="list-h">Recently received from HMIS</h4>
        <Table rows={elec} cols={[
          { label: 'Received', render: (d) => fmtShort(d.receivedAt) },
          { label: 'Source', render: (d) => <Badge tone="info" dot={false}>{d.source}</Badge> },
          { label: 'Document', render: (d) => <span>{docType(d.type).name}{d.lateEntry && <Badge tone="bad">Late Entry</Badge>}</span> },
          { label: 'Patient', render: (d) => <div className="cell-pt"><strong>{name(d.uhid)}</strong><small><Mono>{d.ip}</Mono></small></div> },
          { label: 'Filed', render: (d) => <Badge>{d.intake === 'Manually linked' ? 'Manually linked' : 'Filed'}</Badge> },
        ]} />
      </>}
      {sel && mode === 'receive' && <ReceiveDrawer key={sel.ip} e={sel} onClose={close} />}
      {sel && mode === 'review' && <ReviewDrawer key={sel.ip} e={sel} onClose={close} />}
      {sel && mode === 'accept' && <AcceptDrawer key={sel.ip} e={sel} onClose={close} />}
    </div>
  )
}

function ReceiveDrawer({ e, onClose }) {
  const { s, run, nav } = useStore()
  const h = e.handover
  const user = currentUser(s)
  const [identity, setIdentity] = useState(false)
  const [got, setGot] = useState([])
  const [cond, setCond] = useState('Good')
  const [remarks, setRemarks] = useState('')
  const [ret, setRet] = useState(false)
  const [esc, setEsc] = useState(false)
  const [print, setPrint] = useState(false)
  if (statusOf(e) !== WF.AWAIT_RECEIPT) {
    return (
      <Drawer open onClose={onClose} title={`Received · ${h.ref}`} wide footer={<>
        <Button icon="Printer" onClick={() => setPrint(true)}>Print receipt</Button>
        {['qc', 'supervisor'].includes(user.role) && statusOf(e) === WF.AWAIT_REVIEW && <Button variant="primary" icon="FileCheck2" onClick={() => nav('receiving', { ip: e.ip, open: 'review', tab: 'review' })}>Start review</Button>}
        <Button onClick={onClose}>Done</Button></>}>
        <PatientBanner ip={e.ip} compact />
        <div className="success-big"><Icon name="CircleCheck" size={32} /><div><small>Receipt acknowledged · {fmtDT(h.receivedAt)}</small><strong>Now with the MRD review desk</strong></div></div>
        <StatusDims ip={e.ip} />
        <PrintSlip open={print} onClose={() => setPrint(false)} ip={e.ip} kind="receipt" />
      </Drawer>
    )
  }
  const miss = h.items.filter((i) => !got.includes(i.type))
  const ack = () => run('RECEIVE_HANDOVER', { ip: e.ip, identity, received: got, condition: cond, remarks }, `${h.ref} received – now awaiting review`)
  return (
    <Drawer open onClose={onClose} wide title="Receive record" subtitle={`Handover ${h.ref} · sent ${fmtShort(h.at)} by ${h.by}`}
      footer={<>
        <Button icon="Undo2" onClick={() => setRet(true)}>Return to ward</Button>
        <Button icon="Siren" onClick={() => setEsc(true)}>Escalate</Button>
        <span className="sp" />
        <Button variant="primary" icon="PackageCheck" onClick={ack} disabled={!identity || !got.length}>Acknowledge receipt</Button>
      </>}>
      <PatientBanner ip={e.ip} compact />
      {h.exception && <div className="callout warn"><Icon name="ShieldAlert" size={16} /><div><b>Sent with an authorized exception</b> — {h.exception.reason}. Authorized by {h.exception.authorizedBy}.{h.missing.length > 0 && <> Missing: {h.missing.map((m) => docType(m).name).join(', ')}.</>}</div></div>}
      {h.remarks && <div className="callout"><Icon name="MessageSquare" size={16} /><div><b>Ward remarks:</b> {h.remarks}</div></div>}
      <label className={`bigcheck ${identity ? 'on' : 'attn'}`}><input type="checkbox" checked={identity} onChange={(ev) => setIdentity(ev.target.checked)} />
        <span><b>Identity matches</b><small>Name, UHID and IP number on the file cover match {patientOf(s, e.uhid).name} · {e.uhid} · {e.ip}</small></span></label>
      <Card title={`Count the documents (${got.length}/${h.items.length})`} icon="ListChecks" actions={<Button size="sm" variant="ghost" onClick={() => setGot(got.length === h.items.length ? [] : h.items.map((i) => i.type))}>{got.length === h.items.length ? 'Clear all' : 'All present'}</Button>}>
        <ul className="checks big">
          {h.items.map((it) => <li key={it.type} className={got.includes(it.type) ? 'ok' : ''}><label><input type="checkbox" checked={got.includes(it.type)} onChange={() => setGot(got.includes(it.type) ? got.filter((x) => x !== it.type) : [...got, it.type])} /><span>{docType(it.type).name}</span><small className="muted">{it.pages} page(s)</small></label></li>)}
        </ul>
        {got.length > 0 && miss.length > 0 && <div className="callout bad"><Icon name="FileWarning" size={16} /><div>{miss.length} listed document(s) not in the file: {miss.map((m) => docType(m.type).name).join(', ')}. Acknowledging will flag a handover mismatch to the supervisor — or return the file to the ward.</div></div>}
      </Card>
      <div className="form-grid">
        <Field label="Physical condition"><select value={cond} onChange={(ev) => setCond(ev.target.value)}><option>Good</option><option>Minor wear</option><option>Damaged / torn pages</option><option>Water damaged</option></select></Field>
        <Field label="Received by"><input readOnly value={`${user.name} · ${fmtDT(s.now)}`} /></Field>
      </div>
      <Field label="Remarks" hint="Optional"><textarea rows={2} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} /></Field>
      {ret && <ReturnModal ip={e.ip} onClose={() => setRet(false)} onDone={onClose} />}
      {esc && <EscalateModal ip={e.ip} refId={h.ref} page="receiving" onClose={() => setEsc(false)} />}
    </Drawer>
  )
}

function ReviewDrawer({ e, onClose }) {
  const { s, run, nav } = useStore()
  const [tab, setTab] = useState('checklist')
  const [raise, setRaise] = useState(null)
  const [scanFor, setScanFor] = useState(null)
  const [check, setCheck] = useState(null)
  const [ret, setRet] = useState(false)
  const [esc, setEsc] = useState(false)
  const st = statusOf(e)
  const rows = checklist(s, e)
  const reviewing = st === WF.AWAIT_REVIEW
  const checked = rows.filter((r) => e.review?.items?.[r.type]).length
  const defs = defsOf(s, e.ip)
  const pendingScans = docsOf(s, e.ip).filter((d) => d.status === 'QC Pending')
  const notScanned = rows.filter((r) => ['Not scanned', 'Rescan required'].includes(r.digital))
  const verdict = (r, v) => {
    if (v === 'issue') { setRaise({ type: r.type, category: ['Missing', 'Not received', 'With ward'].includes(r.physical) || r.digital === 'Not received from HMIS' ? 'missing' : 'incomplete' }); return }
    run('REVIEW_ITEM', { ip: e.ip, type: r.type, verdict: e.review?.items?.[r.type] === v ? null : v })
  }
  const okRemaining = () => run('REVIEW_ITEM', { ip: e.ip, types: rows.filter((r) => !e.review?.items?.[r.type] && !r.activeDef).map((r) => r.type), verdict: 'ok' })
  const scanAll = () => { notScanned.forEach((r) => run('SCAN_ITEM', { ip: e.ip, type: r.type, context: 'MRD review' })); run('NAV', { page: 'receiving', params: { ip: e.ip, open: 'review', tab: 'review' } }, `${notScanned.length} document(s) scanned (simulated) – check them next`) }
  const approveClean = () => { const clean = pendingScans.filter((d) => !d.pages.some((p) => p.defect)); clean.forEach((d) => run('VERIFY_SCAN', { id: d.id, ok: true })); run('NAV', { page: 'receiving', params: { ip: e.ip, open: 'review', tab: 'review' } }, `${clean.length} scan(s) verified${pendingScans.length - clean.length ? ` · ${pendingScans.length - clean.length} need a closer look` : ''}`) }
  return (
    <Drawer open onClose={onClose} wide title="Review record" subtitle={reviewing ? `${checked}/${rows.length} documents checked` : st}
      footer={<>
        {reviewing && <Button icon="Undo2" onClick={() => setRet(true)}>Return to ward</Button>}
        <Button icon="Siren" onClick={() => setEsc(true)}>Escalate</Button>
        <span className="sp" />
        <Button icon="Flag" onClick={() => setRaise({ type: '', category: 'clarification' })}>Raise deficiency</Button>
        {reviewing && <Button variant="primary" icon="ClipboardCheck" disabled={checked < rows.length} onClick={() => { const r = run('COMPLETE_REVIEW', { ip: e.ip }, (n) => `Review completed – ${statusOf(encOf(n, e.ip))}`); if (r.ok && statusOf(encOf(r.state, e.ip)) === WF.READY) nav('receiving', { ip: e.ip, open: 'accept', tab: 'ready' }) }}>Complete review</Button>}
        {st === WF.READY && <Button variant="primary" icon="Archive" onClick={() => nav('receiving', { ip: e.ip, open: 'accept', tab: 'ready' })}>Accept Record</Button>}
      </>}>
      <PatientBanner ip={e.ip} compact />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'checklist', label: 'Document checklist', icon: 'ListChecks', count: rows.length }, { id: 'defs', label: 'Deficiencies', icon: 'FileWarning', count: defs.length }, { id: 'coding', label: 'ICD coding', icon: 'Tag' }, { id: 'history', label: 'History', icon: 'History' }]} />
      {tab === 'checklist' && <>
        <div className="toolbar">
          {notScanned.length > 0 && <Button size="sm" icon="ScanLine" onClick={scanAll}>Scan {notScanned.length} remaining <Sim /></Button>}
          {pendingScans.length > 0 && <Button size="sm" icon="BadgeCheck" onClick={approveClean}>Verify clean scans ({pendingScans.length})</Button>}
          <span className="sp" />
          {reviewing && <Button size="sm" variant="ghost" icon="CheckCheck" onClick={okRemaining} disabled={checked === rows.length}>Mark remaining OK</Button>}
        </div>
        <ul className="revlist">
          {rows.map((r) => {
            const v = e.review?.items?.[r.type]
            const scanDoc = r.docs.find((d) => d.status === 'QC Pending')
            return (
              <li key={r.type} className={`rev v-${v || 'none'}`}>
                <div className="rev-name"><strong>{r.name}</strong><small>{r.folder} · {r.electronic ? 'HMIS / EMR' : 'Paper'}</small></div>
                <div className="rev-cell"><small>Physical</small><Badge>{r.physical}</Badge></div>
                <div className="rev-cell"><small>Digital</small><span className="stack-r"><Badge>{r.digital}</Badge>
                  {scanDoc && <button className="linklike small" onClick={() => setCheck(scanDoc)}>Check scan</button>}
                  {['Not scanned', 'Rescan required'].includes(r.digital) && <button className="linklike small" onClick={() => setScanFor(r.type)}>{r.digital === 'Rescan required' ? 'Rescan' : 'Scan'}</button>}
                </span></div>
                <div className="rev-def">{r.activeDef ? <Badge>{r.activeDef.status === 'Open' ? `${r.activeDef.id} open` : `${r.activeDef.id} submitted`}</Badge> : r.defs[0] ? <Badge tone="ok" dot={false}>{r.defs[0].id} {r.defs[0].status.toLowerCase()}</Badge> : null}</div>
                <div className="rev-act" role="group" aria-label={`Verdict for ${r.name}`}>
                  <button className={`vbtn ok ${v === 'ok' ? 'on' : ''}`} disabled={!reviewing || !!r.activeDef} onClick={() => verdict(r, 'ok')} aria-pressed={v === 'ok'}><Icon name="Check" size={14} /> OK</button>
                  <button className={`vbtn issue ${v === 'issue' ? 'on' : ''}`} disabled={!reviewing && st !== WF.READY && st !== WF.CORRECTIONS && st !== WF.AWAIT_VERIFY} onClick={() => verdict(r, 'issue')} aria-pressed={v === 'issue'}><Icon name="Flag" size={14} /> Issue</button>
                </div>
              </li>
            )
          })}
        </ul>
        {reviewing && <Hint>Mark each document <b>OK</b> or raise an <b>Issue</b> (a deficiency assigned to a doctor or the ward). When every line is checked, <b>Complete review</b> moves the record on automatically: corrections required, or ready for acceptance.</Hint>}
      </>}
      {tab === 'defs' && (defs.length ? <div className="deflist">{defs.map((d) => <DefSummary key={d.id} d={d} actions={d.status === 'Correction Submitted' && <Button size="sm" variant="primary" icon="BadgeCheck" onClick={() => nav('deficiencies', { def: d.id, tab: 'verify' })}>Verify Correction</Button>} />)}</div> : <Empty icon="CircleCheck" title="No deficiencies raised" />)}
      {tab === 'coding' && <CodingPanel ip={e.ip} />}
      {tab === 'history' && <RecordHistory ip={e.ip} />}
      {raise && <RaiseDefModal ip={e.ip} docType={raise.type} category={raise.category} onClose={() => setRaise(null)} />}
      {scanFor && <QuickScan ip={e.ip} type={scanFor} context="MRD review" onClose={() => setScanFor(null)} />}
      {check && <ScanCheck doc={check} onClose={() => setCheck(null)} />}
      {ret && <ReturnModal ip={e.ip} onClose={() => setRet(false)} onDone={onClose} />}
      {esc && <EscalateModal ip={e.ip} page="receiving" onClose={() => setEsc(false)} />}
    </Drawer>
  )
}

function AcceptDrawer({ e, onClose }) {
  const { s, run, nav } = useStore()
  const f = fileOf(s, e.fileId)
  const [room, setRoom] = useState('A')
  const [loc, setLoc] = useState(() => freeSlot(s, 'A'))
  const [note, setNote] = useState('')
  const [codeOpen, setCodeOpen] = useState(false)
  const st = statusOf(e)
  const dg = digitalOf(s, e)
  const defs = defsOf(s, e.ip)
  const active = activeDefs(s, e.ip)
  if (st === WF.ARCHIVED) {
    return (
      <Drawer open onClose={onClose} wide title="Record accepted & archived" footer={<><Button icon="Route" onClick={() => nav('tracking', { ip: e.ip })}>View lifecycle</Button><Button variant="primary" onClick={onClose}>Done</Button></>}>
        <PatientBanner ip={e.ip} compact />
        <div className="success-big"><Icon name="Archive" size={32} /><div><small>Accepted {fmtDT(e.acceptance.at)} by {e.acceptance.by}</small><strong>Filed in the MRD archive</strong></div></div>
        {e.acceptance.location && <LocationTrail loc={e.acceptance.location} status="Available" />}
        <StatusDims ip={e.ip} />
      </Drawer>
    )
  }
  const checks = [
    ['Review completed', !!e.review?.completedAt, e.review?.completedAt ? `${fmtShort(e.review.completedAt)} · ${e.review.completedBy || e.review.by}` : 'Not completed'],
    ['Deficiencies closed', active.length === 0, defs.length ? `${defs.filter((d) => d.status === 'Verified').length} verified · ${defs.filter((d) => d.status === 'Waived').length} waived · ${active.length} active` : 'None raised'],
    ['Physical file received', !!e.handover?.receivedAt, e.handover?.receivedAt ? `${fmtShort(e.handover.receivedAt)} · ${e.handover.receivedBy}` : '—'],
    ['Digital copy', dg.pending === 0, `${dg.available}/${dg.total} available${dg.pending ? ` · ${dg.pending} still to scan (allowed — tracked separately)` : ''}`, true],
    ['ICD coding', e.coding.status === 'Coded', e.coding.status === 'Coded' ? e.coding.codes.map((c) => c.code).join(', ') : 'Pending — optional, can be done after archival', true],
  ]
  const canAccept = st === WF.READY
  return (
    <Drawer open onClose={onClose} wide title="Final acceptance" subtitle="Confirm the record is complete and file it in the archive"
      footer={<><Button onClick={onClose}>Cancel</Button><span className="sp" /><Button variant="primary" icon="Archive" disabled={!canAccept || (f && !loc)} onClick={() => run('ACCEPT_RECORD', { ip: e.ip, loc: f ? loc : null, note }, 'Record accepted & archived')}>Accept & archive</Button></>}>
      <PatientBanner ip={e.ip} compact />
      {!canAccept && <div className="callout warn"><Icon name="TriangleAlert" size={16} /><div>This record is <b>{st}</b>; it can be accepted once it reaches Ready for Acceptance.</div></div>}
      <ul className="acc-checks">
        {checks.map(([l, ok, d, soft]) => <li key={l} className={ok ? 'ok' : soft ? 'soft' : 'bad'}><Icon name={ok ? 'CircleCheck' : soft ? 'Info' : 'CircleX'} size={17} /><div><strong>{l}</strong><small>{d}</small></div></li>)}
      </ul>
      {e.coding.status !== 'Coded' && <Button size="sm" variant="ghost" icon="Tag" onClick={() => setCodeOpen(!codeOpen)}>{codeOpen ? 'Hide coding' : 'Code diagnoses now'}</Button>}
      {codeOpen && <Card title="ICD coding" icon="Tag"><CodingPanel ip={e.ip} /></Card>}
      {f ? (
        <Card title="Archive position for the physical file" icon="MapPin" actions={<select value={room} onChange={(ev) => { setRoom(ev.target.value); setLoc(freeSlot(s, ev.target.value)) }} aria-label="Room">{STORAGE.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}>
          <LocationTrail loc={loc} />
          <p className="small muted">Next free position suggested automatically. You can move it later from the Archive Map.</p>
        </Card>
      ) : <div className="callout"><Icon name="Info" size={16} /><div>No physical file — electronic record only.</div></div>}
      <Field label="Acceptance note" hint="Optional"><input value={note} onChange={(ev) => setNote(ev.target.value)} /></Field>
    </Drawer>
  )
}

function Exceptions({ docs }) {
  const { s, run } = useStore()
  const [sel, setSel] = useState(null)
  const [ip, setIp] = useState('')
  const [type, setType] = useState('')
  const cand = s.encounters.filter((e) => !e.archive && e.discharged)
  if (!docs.length) return <Empty icon="CircleCheck" title="No intake exceptions">Unmatched or unclassified documents from interfaces would appear here.</Empty>
  return (
    <>
      <Hint>Documents that could not be filed automatically are never guessed into a record. MRD links them to the correct patient/encounter, classifies them, or returns them to the source system.</Hint>
      <div className="cards">
        {docs.map((d) => (
          <div key={d.id} className="xcard">
            <div className="xcard-top"><Badge>{d.intake}</Badge><Badge tone="info" dot={false}>{d.source}</Badge><Mono>{d.id}</Mono></div>
            <strong>{d.type === 'UNMAPPED' ? d.claimedType : docType(d.type).name}</strong>
            <p className="small">{d.reason}</p>
            <dl className="dl dl-tight"><dt>UHID in message</dt><dd><Mono>{d.uhid || '—'}</Mono></dd>{d.claimedName && <><dt>Name in message</dt><dd>{d.claimedName}</dd></>}<dt>Received</dt><dd>{fmtDT(d.receivedAt)}</dd></dl>
            <div className="row-end"><Button size="sm" onClick={() => run('RETURN_SOURCE', { id: d.id, reason: 'Returned for correction' }, 'Returned to source system')}>Return to source</Button><Button size="sm" variant="primary" icon="Link2" onClick={() => { setSel(d); setIp(d.ip || ''); setType(d.type === 'UNMAPPED' ? '' : d.type) }}>{d.intake === 'Unclassified' ? 'Classify' : 'Link to patient'}</Button></div>
          </div>
        ))}
      </div>
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.intake === 'Unclassified' ? 'Classify document' : 'Link to patient & encounter'}
        footer={<><Button onClick={() => setSel(null)}>Cancel</Button><Button variant="primary" disabled={!ip || !type} onClick={() => { if (run('LINK_DOC', { id: sel.id, ip, type }, 'Document filed to patient record').ok) setSel(null) }}>File document</Button></>}>
        <Field label="Patient / encounter" required hint="Confirm with the patient banner before filing (BR-03).">
          <select value={ip} onChange={(e) => setIp(e.target.value)}><option value="">Select…</option>{cand.map((e) => <option key={e.ip} value={e.ip}>{patientOf(s, e.uhid).name} · {e.uhid} · {e.ip}</option>)}</select>
        </Field>
        {ip && <PatientBanner ip={ip} compact />}
        <Field label="MRD document type" required>
          <select value={type} onChange={(e) => setType(e.target.value)}><option value="">Select…</option>{DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.folder})</option>)}</select>
        </Field>
      </Modal>
    </>
  )
}
