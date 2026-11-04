import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { checklistTypes, docType, currentUser, WF, WARDS } from '../data/catalog'
import { H, docsOf, fmtShort, fmtDT, patientOf, statusOf, encOf, custodyOf, activeDefs, toDateInput, fromDateInput } from '../lib/logic'
import { PageHead, Tabs, Table, Badge, Tat, Mono, Empty, PatientBanner, Card, Button, Field, Modal, Drawer, Icon, Hint, Sim, SearchBox, Pending } from '../components/ui'
import { PrintSlip } from '../components/PrintSlip'

const OPTIONAL = ['TPR', 'IO', 'OTH']
const AUTHORIZERS = ['Sr. Rekha More (Nursing Supervisor)', 'Sr. Mary Thomas (Night Nursing Supervisor)', 'Dr. Sunita Deshpande (MRD Manager)']
const EXC_REASONS = ['Document retained by OT / cath lab for counter-signature', 'Original sent with patient on transfer', 'Document with billing / TPA desk', 'Form never generated for this admission', 'Other (explain in remarks)']
const SENT_STATUSES = [WF.AWAIT_RECEIPT, WF.AWAIT_REVIEW, WF.CORRECTIONS, WF.AWAIT_VERIFY, WF.READY, WF.ARCHIVED]

export default function Handover() {
  const { s, nav, run } = useStore()
  const user = currentUser(s)
  const params = s.route.params || {}
  const [tab, setTab] = useState(params.tab || 'notsent')
  const [q, setQ] = useState('')
  const [ward, setWard] = useState(user.role === 'nurse' ? 'mine' : 'all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState(params.status || '')
  const [simFor, setSimFor] = useState(null)
  const [disType, setDisType] = useState('Normal')
  const name = (u) => patientOf(s, u)?.name || ''

  const live = s.encounters.filter((e) => !e.archive)
  const wardOk = (e) => ward === 'all' || (ward === 'mine' ? (user.wards ? user.wards.includes(e.ward) : true) : e.ward === ward)
  const textOk = (e) => !q || [name(e.uhid), e.uhid, e.ip, e.ward, e.handover?.ref || ''].some((v) => v.toLowerCase().includes(q.toLowerCase()))
  const dateOk = (e) => (!from || e.discharged >= fromDateInput(from)) && (!to || e.discharged <= fromDateInput(to, true))
  const base = live.filter((e) => wardOk(e) && textOk(e))
  const notSent = base.filter((e) => [WF.NOT_SENT, WF.RETURNED].includes(statusOf(e)) && dateOk(e))
  const sent = base.filter((e) => SENT_STATUSES.includes(statusOf(e)) && e.handover && dateOk(e))
  const admitted = base.filter((e) => statusOf(e) === WF.ADMITTED)
  const filt = (list) => list.filter((e) => !status || (status === 'Draft saved' ? !!e.prep : statusOf(e) === status))
  const rowsNS = filt(notSent).sort((a, b) => (statusOf(b) === WF.RETURNED) - (statusOf(a) === WF.RETURNED) || a.discharged - b.discharged)
  const rowsS = filt(sent).sort((a, b) => b.handover.at - a.handover.at)
  const sel = params.ip && encOf(s, params.ip)
  const switchTab = (t) => { setTab(t); setStatus('') }

  return (
    <div className="page">
      <PageHead kicker="Ward → MRD" title="Nurse Handover" info="Patients appear here automatically when HMIS records a discharge. Prepare the file with the checklist, then send it to MRD — no register entry needed." />
      <div className="filters neo-in">
        <SearchBox value={q} onChange={setQ} placeholder="Patient name, UHID, IP number or handover ref" />
        <select value={ward} onChange={(e) => setWard(e.target.value)} aria-label="Ward">
          {user.wards && <option value="mine">My wards</option>}
          <option value="all">All wards</option>
          {WARDS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <label className="date-f"><span>Discharged from</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={toDateInput(s.now)} /></label>
        <label className="date-f"><span>to</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} max={toDateInput(s.now)} /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {(tab === 'notsent' ? [WF.NOT_SENT, 'Draft saved', WF.RETURNED] : SENT_STATUSES).map((x) => <option key={x}>{x}</option>)}
        </select>
        {(q || from || to || status || ward !== (user.role === 'nurse' ? 'mine' : 'all')) && <Button size="sm" variant="ghost" icon="X" onClick={() => { setQ(''); setFrom(''); setTo(''); setStatus(''); setWard(user.role === 'nurse' ? 'mine' : 'all') }}>Clear</Button>}
      </div>
      <Tabs value={tab} onChange={switchTab} tabs={[
        { id: 'notsent', label: 'Records Not Sent', icon: 'ClipboardList', count: notSent.length },
        { id: 'sent', label: 'Records Sent', icon: 'Send', count: sent.length },
        { id: 'admitted', label: 'Still admitted', icon: 'Hospital', count: admitted.length },
      ]} />
      {tab === 'notsent' && (
        <Table rows={rowsNS} rowKey={(e) => e.ip} rowClass={(e) => (statusOf(e) === WF.RETURNED ? 'row-alert' : '')}
          cols={[
            { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.uhid}</Mono> · <Mono>{e.ip}</Mono></small></div> },
            { label: 'Ward / bed', render: (e) => <span>{e.ward}<small className="block muted">Bed {e.bed} · {e.consultant}</small></span> },
            { label: 'Discharged', render: (e) => <span>{fmtShort(e.discharged)}{e.dischargeType !== 'Normal' && <Badge tone="warn">{e.dischargeType}</Badge>}</span> },
            { label: 'Status', render: (e) => <span className="stack-r"><Badge>{statusOf(e)}</Badge>{e.prep && <Badge tone="warn" dot={false}>Draft saved</Badge>}{statusOf(e) === WF.RETURNED && <small className="t-bad">{e.handover?.returnReason}</small>}</span> },
            { label: 'Waiting', render: (e) => <span className="stack-r"><Pending since={statusOf(e) === WF.RETURNED ? e.statusAt : e.discharged} now={s.now} /><Tat due={(statusOf(e) === WF.RETURNED ? e.statusAt : e.discharged) + s.config.tat.handover * H} now={s.now} /></span> },
            { label: '', cls: 'cell-act', render: (e) => <Button variant="primary" size="sm" icon={statusOf(e) === WF.RETURNED ? 'Undo2' : 'ClipboardCheck'} onClick={() => nav('handover', { ip: e.ip, tab })}>{statusOf(e) === WF.RETURNED ? 'Fix & Resend' : e.prep ? 'Continue' : 'Prepare Handover'}</Button> },
          ]}
          empty={<Empty icon="CircleCheck" title="Every discharged record has been sent">New discharges appear here automatically from HMIS. Try “Still admitted” to simulate one.</Empty>} />
      )}
      {tab === 'sent' && (
        <Table rows={rowsS} rowKey={(e) => e.ip}
          cols={[
            { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.handover.ref}</Mono>{e.handover.version > 1 && ` · v${e.handover.version}`}</small></div> },
            { label: 'Sent', render: (e) => <span>{fmtShort(e.handover.at)}<small className="block muted">{e.handover.by}</small></span> },
            { label: 'Where now', render: (e) => <span className="stack-r"><Badge>{statusOf(e)}</Badge><small className="muted">{custodyOf(s, e).label}</small></span> },
            { label: 'Ward action', render: (e) => { const n = activeDefs(s, e.ip).filter((d) => d.assignee.kind === 'ward' && d.status === 'Open').length; return n ? <Button size="sm" icon="FileWarning" onClick={() => nav('deficiencies', { ip: e.ip })}>{n} to fix</Button> : <span className="muted small">None</span> } },
            { label: '', cls: 'cell-act', render: (e) => <span className="row-end"><PrintBtn ip={e.ip} /><TrackBtn ip={e.ip} /></span> },
          ]} empty={<Empty title="Nothing sent in this period" />} />
      )}
      {tab === 'admitted' && (
        <>
          <Hint><Sim>Simulated HMIS</Sim> In the live product admissions and discharges arrive from the HMIS ADT feed. Here you can create them to get fresh patients to work on.</Hint>
          <div className="row-end"><Button size="sm" icon="Plus" onClick={() => run('SIM_ADMIT', {}, (st) => `New admission created – ${st.lastRef}`)}>Simulate new admission</Button></div>
          <Table rows={admitted} rowKey={(e) => e.ip}
            cols={[
              { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.ip}</Mono> · {e.ward} / {e.bed}</small></div> },
              { label: 'Admitted', render: (e) => fmtShort(e.admitted) },
              { label: 'Consultant', key: 'consultant' },
              { label: '', cls: 'cell-act', render: (e) => <Button size="sm" icon="LogOut" onClick={() => setSimFor(e)}>Simulate discharge</Button> },
            ]} empty={<Empty title="No admitted patients in these wards" />} />
        </>
      )}
      {sel && [WF.NOT_SENT, WF.RETURNED].includes(statusOf(sel)) && <PrepareDrawer key={sel.ip} e={sel} onClose={() => nav('handover', { tab })} />}
      {sel && ![WF.NOT_SENT, WF.RETURNED].includes(statusOf(sel)) && <SentDrawer key={sel.ip} e={sel} onClose={() => nav('handover', { tab })} />}
      <Modal open={!!simFor} onClose={() => setSimFor(null)} title="Simulate HMIS discharge" subtitle={simFor && `${name(simFor.uhid)} · ${simFor.ip}`}
        footer={<><Button onClick={() => setSimFor(null)}>Cancel</Button><Button variant="primary" icon="Check" onClick={() => { if (run('SIM_DISCHARGE', { ip: simFor.ip, dischargeType: disType }, 'Discharge recorded – patient added to Records Not Sent').ok) { setTab('notsent'); setSimFor(null) } }}>Record discharge</Button></>}>
        <Field label="Discharge type" hint="DAMA and Death add the DAMA form / death summary to the required checklist.">
          <select value={disType} onChange={(e) => setDisType(e.target.value)}><option>Normal</option><option>DAMA</option><option>Death</option><option>Transfer</option></select>
        </Field>
        <p className="small muted"><Sim>Simulated</Sim> The discharge summary, initial assessment and lab reports will be “received” from EMR/LIS automatically.</p>
      </Modal>
    </div>
  )
}

function TrackBtn({ ip }) {
  const { openTrack } = useStore()
  return <Button size="sm" variant="ghost" icon="Route" onClick={() => openTrack(ip)}>Lifecycle</Button>
}
function PrintBtn({ ip }) {
  const [open, setOpen] = useState(false)
  return <><Button size="sm" variant="ghost" icon="Printer" onClick={() => setOpen(true)}>Slip</Button><PrintSlip open={open} onClose={() => setOpen(false)} ip={ip} kind="handover" /></>
}

function SentDrawer({ e, onClose }) {
  const { s } = useStore()
  const [print, setPrint] = useState(false)
  const justSent = e.handover && s.now - e.handover.at <= 3 * 60000
  return (
    <Drawer open onClose={onClose} title={justSent ? 'Sent to MRD' : `Handover ${e.handover?.ref || ''}`} subtitle={justSent ? 'Handover recorded' : 'Already sent to MRD'} wide
      footer={<><Button icon="Printer" onClick={() => setPrint(true)}>Print acknowledgement</Button><Button variant="primary" onClick={onClose}>Done</Button></>}>
      <PatientBanner ip={e.ip} compact />
      {justSent && <div className="success-big"><Icon name="CircleCheck" size={36} /><div><small>Handover reference</small><strong className="mono">{e.handover.ref}</strong></div></div>}
      {justSent && <p>{patientOf(s, e.uhid).name}’s file is now in MRD’s <b>Awaiting Receipt</b> list and marked <b>In transit to MRD</b> until the counter acknowledges it. Follow it under Records Sent.</p>}
      <SentSummary e={e} />
      <PrintSlip open={print} onClose={() => setPrint(false)} ip={e.ip} kind="handover" />
    </Drawer>
  )
}
function SentSummary({ e }) {
  const h = e.handover
  return (
    <Card title="What was sent" icon="PackageCheck">
      <dl className="dl">
        <dt>Reference</dt><dd><Mono>{h.ref}</Mono>{h.version > 1 && ` · version ${h.version}`}</dd>
        <dt>Sent</dt><dd>{fmtDT(h.at)} by {h.by} · via {h.carrier}</dd>
        <dt>Physical documents</dt><dd>{h.items.map((it) => `${docType(it.type).name} (${it.pages}p)`).join(', ')}</dd>
        <dt>Missing</dt><dd>{h.missing.length ? h.missing.map((m) => <Badge key={m} tone="bad">{docType(m).name}</Badge>) : 'None'}</dd>
        {h.exception && <><dt>Exception</dt><dd>{h.exception.reason} · authorized by {h.exception.authorizedBy}</dd></>}
        {h.remarks && <><dt>Remarks</dt><dd>{h.remarks}</dd></>}
        <dt>MRD receipt</dt><dd>{h.receivedAt ? `${fmtDT(h.receivedAt)} by ${h.receivedBy}` : <Badge>Awaiting Receipt</Badge>}</dd>
      </dl>
    </Card>
  )
}

function PrepareDrawer({ e, onClose }) {
  const { s, run } = useStore()
  const user = currentUser(s)
  const returned = statusOf(e) === WF.RETURNED
  const electronic = docsOf(s, e.ip).filter((d) => d.kind === 'electronic')
  const required = checklistTypes(e)
  const reqPhysical = required.filter((t) => docType(t).src === 'Physical')
  const reqElectronic = required.filter((t) => docType(t).src !== 'Physical')
  const physTypes = useMemo(() => [...new Set([...reqPhysical, ...OPTIONAL])], [e.ip])
  const prev = e.prep?.items || (returned ? Object.fromEntries(e.handover.items.map((i) => [i.type, { present: true, pages: i.pages }])) : null)
  const [items, setItems] = useState(() => Object.fromEntries(physTypes.map((t) => [t, prev?.[t] ? { present: !!prev[t].present, pages: prev[t].pages || docType(t).pages || 1 } : { present: reqPhysical.includes(t), pages: docType(t).pages || 1 }])))
  const [step, setStep] = useState(0)
  const [remarks, setRemarks] = useState(e.prep?.remarks || '')
  const [carrier, setCarrier] = useState(e.prep?.carrier || 'Ward attendant – Suresh More')
  const [useExc, setUseExc] = useState(!!e.prep?.exception)
  const [exc, setExc] = useState(e.prep?.exception || { reason: EXC_REASONS[0], authorizedBy: AUTHORIZERS[0], confirmed: false })
  const [scanFor, setScanFor] = useState(null)
  const missing = reqPhysical.filter((t) => !items[t].present)
  const missingE = reqElectronic.filter((t) => !electronic.some((d) => d.type === t))
  const scannedTypes = new Set(docsOf(s, e.ip).filter((d) => d.kind === 'scanned' && d.status !== 'Awaiting Scan').map((d) => d.type))
  const ticked = physTypes.filter((t) => items[t].present)
  const prepObj = () => ({ items, remarks, carrier, exception: useExc ? exc : null })

  const send = () => {
    const r = run('SUBMIT_HANDOVER', {
      ip: e.ip, items: ticked.map((t) => ({ type: t, pages: Number(items[t].pages) || 1 })),
      electronic: electronic.map((d) => d.id), remarks, carrier, exception: missing.length && useExc ? exc : null,
    })
    return r
  }

  const steps = ['Check documents', 'Missing items & remarks', 'Review & send']
  return (
    <Drawer open onClose={onClose} wide title={returned ? 'Fix & resend to MRD' : 'Prepare handover'} subtitle={`${steps[step]} · step ${step + 1} of 3`}
      footer={<>
        <Button icon="Save" onClick={() => run('SAVE_PREP', { ip: e.ip, prep: prepObj() }, 'Draft saved – you can continue later')}>Save draft</Button>
        <span className="sp" />
        {step > 0 && <Button icon="ChevronLeft" onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 2 && <Button variant="primary" icon="ArrowRight" onClick={() => setStep(step + 1)}>Next</Button>}
        {step === 2 && <Button variant="primary" icon="Send" onClick={send} disabled={missing.length > 0 && !(useExc && exc.confirmed)}>Send to MRD</Button>}
      </>}>
      <PatientBanner ip={e.ip} compact />
      {returned && <div className="callout bad"><Icon name="Undo2" size={16} /><div><b>Returned by MRD</b> · {e.handover.returnedBy} · {fmtDT(e.handover.returnedAt)}<br />{e.handover.returnReason}</div></div>}
      <ol className="wizard mini" aria-label="Steps">{steps.map((t, i) => <li key={t}><button className={`${step === i ? 'on' : ''} ${i < step ? 'done' : ''}`} onClick={() => setStep(i)}><span className="wz-n">{i < step ? <Icon name="Check" size={12} /> : i + 1}</span><b>{t}</b></button></li>)}</ol>

      {step === 0 && <>
        <Card title="Physical file — tick what is in the file" icon="ListChecks" actions={<span className="small muted">{ticked.length} ticked · {missing.length ? <b className="t-bad">{missing.length} required missing</b> : 'all required present'}</span>}>
          <ul className="checks checks-pages big">
            {physTypes.map((t) => {
              const req = reqPhysical.includes(t)
              return (
                <li key={t} className={!items[t].present && req ? 'miss' : items[t].present ? 'ok' : ''}>
                  <label><input type="checkbox" checked={items[t].present} onChange={(ev) => setItems({ ...items, [t]: { ...items[t], present: ev.target.checked } })} />
                    <span>{docType(t).name}</span>{req ? <Badge tone="mute" dot={false}>Required</Badge> : <small className="muted">optional</small>}</label>
                  {items[t].present && <span className="pages-in"><input type="number" min="1" max="99" value={items[t].pages} aria-label={`${docType(t).name} pages`} onChange={(ev) => setItems({ ...items, [t]: { ...items[t], pages: ev.target.value } })} /> p</span>}
                  {items[t].present && (scannedTypes.has(t) ? <Badge tone="ok" dot={false}>Scanned</Badge> : <Button size="sm" variant="ghost" icon="ScanLine" onClick={() => setScanFor(t)} title="Optional: scan at the ward if a scanner is available">Scan</Button>)}
                  {!items[t].present && req && <Badge tone="bad">Missing</Badge>}
                </li>
              )
            })}
          </ul>
        </Card>
        <Card title="Electronic documents — already in HMIS" icon="Database" actions={<Sim>From EMR / LIS / RIS</Sim>}>
          <p className="small muted">These arrived automatically; nothing to print or attach.</p>
          <ul className="checks">
            {electronic.map((d) => <li key={d.id} className="ok"><Icon name="CircleCheck" size={15} /><span>{docType(d.type).name}</span><Badge tone="info" dot={false}>{d.source}</Badge><small className="muted">{fmtShort(d.receivedAt)}</small></li>)}
            {missingE.map((t) => <li key={t} className="miss"><Icon name="TriangleAlert" size={14} /><span>{docType(t).name}</span><Badge tone="bad">Not received from HMIS</Badge></li>)}
          </ul>
        </Card>
      </>}

      {step === 1 && <>
        {missing.length > 0 ? (
          <Card title={`${missing.length} required document(s) missing`} icon="TriangleAlert" className="card-warn">
            <ul className="bul">{missing.map((m) => <li key={m}><b>{docType(m).name}</b></li>)}</ul>
            <p className="small">Incomplete files are not accepted. Find the document and tick it in step 1, or — only if a supervisor has approved — send with an <b>authorized exception</b>.</p>
            <label className={`bigcheck ${useExc ? 'on' : ''}`}><input type="checkbox" checked={useExc} onChange={(ev) => setUseExc(ev.target.checked)} /><span><b>Send with an authorized exception</b><small>MRD will see the exception and may raise a deficiency.</small></span></label>
            {useExc && <div className="form-grid">
              <Field label="Reason" required><select value={exc.reason} onChange={(ev) => setExc({ ...exc, reason: ev.target.value })}>{EXC_REASONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Authorized by" required><select value={exc.authorizedBy} onChange={(ev) => setExc({ ...exc, authorizedBy: ev.target.value })}>{AUTHORIZERS.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <label className="bigcheck span2"><input type="checkbox" checked={exc.confirmed} onChange={(ev) => setExc({ ...exc, confirmed: ev.target.checked })} /><span><b>I confirm {exc.authorizedBy.split(' (')[0]} approved sending this file without the missing document(s)</b><small>Recorded with your name and the time. In production the approval would be captured in the authorizer’s own login.</small></span></label>
            </div>}
          </Card>
        ) : <div className="callout ok"><Icon name="CircleCheck" size={16} /><div>All required documents are in the file.</div></div>}
        <Card title="Remarks & delivery" icon="Truck">
          <div className="form-grid">
            <Field label="Handed over by"><input value={user.name} readOnly /></Field>
            <Field label="Carried to MRD by"><input value={carrier} onChange={(ev) => setCarrier(ev.target.value)} /></Field>
          </div>
          <Field label="Remarks for MRD" hint={missing.length ? 'Explain where the missing document is and when it will follow.' : 'Optional'}><textarea rows={3} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} /></Field>
        </Card>
      </>}

      {step === 2 && <Card title="Review & send" icon="Send">
        <dl className="dl">
          <dt>Physical documents</dt><dd>{ticked.map((t) => `${docType(t).name} (${items[t].pages}p)`).join(', ')}</dd>
          <dt>Electronic (HMIS)</dt><dd>{electronic.length} document(s)</dd>
          <dt>Missing</dt><dd>{missing.length ? missing.map((m) => <Badge key={m} tone="bad">{docType(m).name}</Badge>) : 'None'}</dd>
          {missing.length > 0 && <><dt>Exception</dt><dd>{useExc ? (exc.confirmed ? `${exc.reason} · authorized by ${exc.authorizedBy}` : <span className="t-bad">Not confirmed yet — go back to step 2</span>) : <span className="t-bad">Not allowed without an authorized exception</span>}</dd></>}
          <dt>Carried by</dt><dd>{carrier}</dd>
          {remarks && <><dt>Remarks</dt><dd>{remarks}</dd></>}
        </dl>
        <Hint>Sending generates a handover reference, timestamps it with your name, moves the file to <b>In transit</b> and adds it to MRD’s Awaiting Receipt list. You can print an acknowledgement slip for the file cover.</Hint>
      </Card>}
      {scanFor && <QuickScan ip={e.ip} type={scanFor} context="ward handover" onClose={() => setScanFor(null)} />}
    </Drawer>
  )
}

// Small scan/upload dialog used from checklists (ward handover, MRD review)
export function QuickScan({ ip, type, context, onClose }) {
  const { run } = useStore()
  const [pages, setPages] = useState(docType(type).pages || 1)
  const [method, setMethod] = useState('scan')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const go = () => {
    setBusy(true)
    setTimeout(() => {
      const r = run('SCAN_ITEM', { ip, type, pages, context, uploads: method === 'upload' && file ? [file] : null }, `${docType(type).name} ${method === 'upload' ? 'uploaded' : 'scanned'} – waiting for scan check`)
      setBusy(false)
      if (r.ok) onClose()
    }, 600)
  }
  return (
    <Modal open onClose={onClose} title={`Scan · ${docType(type).name}`} subtitle="The digital copy is linked to this admission and checked by MRD before it counts as available."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={method === 'scan' ? 'Scan' : 'Upload'} disabled={busy || (method === 'upload' && !file)} onClick={go}>{busy ? 'Working…' : method === 'scan' ? 'Scan now' : 'Upload'}</Button></>}>
      <div className="seg"><button className={method === 'scan' ? 'on' : ''} onClick={() => setMethod('scan')}><Icon name="ScanLine" size={14} /> Scanner</button><button className={method === 'upload' ? 'on' : ''} onClick={() => setMethod('upload')}><Icon name="Upload" size={14} /> Upload file</button></div>
      {method === 'scan' ? (
        <><Field label="Pages"><input type="number" min="1" max="40" value={pages} onChange={(ev) => setPages(ev.target.value)} /></Field><p className="small muted"><Sim>Simulated scanner</Sim> No scanner hardware is connected in this prototype.</p></>
      ) : (
        <Field label="File" hint="PDF, JPG, PNG or TIFF · max 25 MB">
          <div className="drop"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" aria-label="Choose file" onChange={(ev) => { const f = ev.target.files[0]; if (f) setFile({ name: f.name, size: f.size }) }} /><span><Icon name="Upload" size={16} /> {file ? file.name : 'Choose a file'}</span></div>
        </Field>
      )}
      {busy && <div className="scanning-bar"><span /></div>}
    </Modal>
  )
}
