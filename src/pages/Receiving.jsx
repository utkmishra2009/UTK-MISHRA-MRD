import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { docType, DOC_TYPES, canAccess } from '../data/catalog'
import { H, fmtShort, fmtDT, patientOf, stageOf, docsOf } from '../lib/logic'
import { MobileBack } from '../components/ui'
import { PageHead, Tabs, Table, Badge, Tat, Mono, Empty, PatientBanner, Card, Button, Field, Modal, Icon, Hint, Sim, SearchBox } from '../components/ui'

export default function Receiving() {
  const { s, nav, run } = useStore()
  const params = s.route.params || {}
  const [tab, setTab] = useState(params.tab || 'physical')
  useEffect(() => { if (params.tab) setTab(params.tab) }, [params.tab])
  const [q, setQ] = useState('')
  const name = (u) => patientOf(s, u)?.name || ''
  const match = (e) => !q || [name(e.uhid), e.uhid, e.ip, e.handover?.ref || ''].some((v) => v.toLowerCase().includes(q.toLowerCase()))
  const live = s.encounters.filter((e) => !e.archive && e.handover)
  const pending = live.filter((e) => e.handover.status === 'Submitted' && match(e))
  const recent = live.filter((e) => e.handover.status === 'Received' && e.handover.receivedAt > s.now - 72 * H && match(e)).sort((a, b) => b.handover.receivedAt - a.handover.receivedAt)
  const elec = s.documents.filter((d) => d.kind === 'electronic' && d.status !== 'Exception' && (!q || [name(d.uhid), d.uhid, d.ip].some((v) => (v || '').toLowerCase().includes(q.toLowerCase())))).sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 40)
  const exc = s.documents.filter((d) => d.status === 'Exception')
  const sel = params.ip && s.encounters.find((e) => e.ip === params.ip)

  return (
    <div className="page">
      <PageHead kicker="MRD intake" title="Receiving & document ingestion" info="Two ways records reach MRD: physical files handed over by wards, and electronic documents sent by hospital systems.">
        <Button icon="Database" onClick={() => { const r = run('SIM_ARRIVAL', {}, 'New electronic document received (simulated interface message)'); if (r.ok) setTab('electronic') }}>Simulate incoming document</Button>
      </PageHead>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'physical', label: 'Physical handovers', icon: 'Package', count: pending.length },
        { id: 'electronic', label: 'Electronic intake', icon: 'Database', count: elec.filter((d) => d.receivedAt > s.now - 24 * H).length },
        { id: 'exceptions', label: 'Exceptions', icon: 'FileWarning', count: exc.length },
      ]} />
      {tab === 'physical' && (
        <div className={`split ${sel ? 'has-detail' : ''}`}>
          <div className="split-list">
            <SearchBox value={q} onChange={setQ} placeholder="Search patient, UHID, handover ref" />
            <h4 className="list-h">Awaiting receipt</h4>
            <Table rows={pending} rowKey={(e) => e.ip} onRow={(e) => nav('receiving', { ip: e.ip })} rowClass={(e) => (e.ip === params.ip ? 'sel' : '')}
              cols={[
                { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.handover.ref}</Mono> · {e.ward}</small></div> },
                { label: 'Items', render: (e) => <span>{e.handover.items.length} docs{e.handover.missing.length > 0 && <Badge tone="bad">{e.handover.missing.length} missing</Badge>}</span> },
                { label: 'TAT', render: (e) => <Tat due={e.handover.at + s.config.tat.receipt * H} now={s.now} /> },
              ]} empty={<Empty icon="CircleCheck" title="No files waiting at the counter" />} />
            <h4 className="list-h">Received (last 72 h)</h4>
            <Table rows={recent} rowKey={(e) => e.ip} onRow={(e) => nav('receiving', { ip: e.ip })} rowClass={(e) => (e.ip === params.ip ? 'sel' : '')}
              cols={[
                { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.handover.ref}</Mono></small></div> },
                { label: 'Received', render: (e) => fmtShort(e.handover.receivedAt) },
                { label: 'Now', render: (e) => <Badge>{stageOf(s, e).label}</Badge> },
              ]} empty={<Empty title="None yet" />} />
          </div>
          <div className="split-detail"><MobileBack />
            {sel ? <ReceiveForm key={sel.ip} e={sel} /> : <Empty icon="Inbox" title="Select a handover">Open a handover to verify identity, inventory and condition before MRD takes custody.</Empty>}
          </div>
        </div>
      )}
      {tab === 'electronic' && (
        <>
          <Hint><Sim>Simulated integrations</Sim> Documents below represent finalized documents an EMR, LIS, RIS or HIS would send. No real system is connected; use “Simulate incoming document” to create a new arrival.</Hint>
          <Table rows={elec} onRow={(d) => d.ip && nav('patient', { ip: d.ip, tab: 'docs' })}
            cols={[
              { label: 'Received', render: (d) => fmtShort(d.receivedAt) },
              { label: 'Source', render: (d) => <Badge tone="info" dot={false}>{d.source}</Badge> },
              { label: 'Document', render: (d) => <span>{docType(d.type).name}{d.lateEntry && <Badge tone="bad">Late Entry</Badge>}</span> },
              { label: 'Patient', render: (d) => <div className="cell-pt"><strong>{name(d.uhid)}</strong><small><Mono>{d.uhid}</Mono> · <Mono>{d.ip}</Mono></small></div> },
              { label: 'Processing', render: (d) => <Badge>{d.intake === 'Manually linked' ? 'Manually linked' : 'Filed'}</Badge> },
            ]} />
        </>
      )}
      {tab === 'exceptions' && <Exceptions docs={exc} />}
    </div>
  )
}

function ReceiveForm({ e }) {
  const { s, run, nav } = useStore()
  const h = e.handover
  const [identity, setIdentity] = useState(false)
  const [got, setGot] = useState(() => (h.status === 'Received' ? h.items.map((i) => i.type) : []))
  const [cond, setCond] = useState('Good')
  const [remarks, setRemarks] = useState('')
  const [ret, setRet] = useState(false)
  const [reason, setReason] = useState('')
  const elec = docsOf(s, e.ip).filter((d) => d.kind === 'electronic')
  if (h.status === 'Received') {
    return (
      <div className="detail">
        <PatientBanner ip={e.ip} />
        <Card title={`Receipt record · ${h.ref}`} icon="PackageCheck">
          <dl className="dl">
            <dt>Received</dt><dd>{fmtDT(h.receivedAt)} by {h.receivedBy}</dd>
            <dt>Identity</dt><dd><Badge>Good</Badge> verified</dd>
            <dt>Inventory</dt><dd>{h.check?.inventory ? <Badge tone="ok">Matched</Badge> : <Badge tone="bad">Mismatch: {h.check?.notReceived?.map((t) => docType(t).name).join(', ')}</Badge>}</dd>
            <dt>Condition</dt><dd><Badge>{h.check?.condition || 'Good'}</Badge></dd>
            <dt>Routed to</dt><dd>Document intake · {docsOf(s, e.ip).filter((d) => d.status === 'Awaiting Scan').length} document(s) still to digitize</dd>
          </dl>
          {canAccess(s.role, 'intake') && docsOf(s, e.ip).some((d) => d.status === 'Awaiting Scan') && <div className="row-end"><Button variant="primary" icon="FileScan" onClick={() => nav('intake', { ip: e.ip })}>Start document intake</Button></div>}
        </Card>
      </div>
    )
  }
  const accept = () => run('RECEIVE_HANDOVER', { ip: e.ip, identity, received: got, condition: cond, remarks }, `${h.ref} accepted – ${got.length} document(s) routed to scanning`)
  const miss = h.items.filter((i) => !got.includes(i.type))
  return (
    <div className="detail">
      <PatientBanner ip={e.ip} />
      <Card title={`Handover ${h.ref}`} icon="Package" actions={<span className="muted small">Sent {fmtShort(h.at)} by {h.by}</span>}>
        {h.missing.length > 0 && <div className="callout warn"><Icon name="TriangleAlert" size={16} /><div><b>Ward reported missing:</b> {h.missing.map((m) => docType(m).name).join(', ')}{h.remarks && <> — “{h.remarks}”</>}</div></div>}
        <label className="bigcheck"><input type="checkbox" checked={identity} onChange={(ev) => setIdentity(ev.target.checked)} />
          <span><b>Identity verified</b><small>Name, UHID and IP number on the file cover match: {patientOf(s, e.uhid).name} · {e.uhid} · {e.ip}</small></span></label>
        <div className="sub-h"><span>Physical inventory ({got.length}/{h.items.length} verified)</span><Button size="sm" variant="ghost" onClick={() => setGot(got.length === h.items.length ? [] : h.items.map((i) => i.type))}>{got.length === h.items.length ? 'Clear all' : 'Tick all'}</Button></div>
        <ul className="checks">
          {h.items.map((it) => (
            <li key={it.type} className={got.includes(it.type) ? 'ok' : ''}><label><input type="checkbox" checked={got.includes(it.type)} onChange={() => setGot(got.includes(it.type) ? got.filter((x) => x !== it.type) : [...got, it.type])} />
              <span>{docType(it.type).name}</span><small className="muted">{it.pages} page(s)</small></label></li>
          ))}
        </ul>
        <div className="sub-h"><span>Electronic documents on record</span></div>
        <p className="small muted">{elec.map((d) => `${docType(d.type).name} (${d.source})`).join(' · ')}</p>
        <div className="form-grid">
          <Field label="Physical condition">
            <select value={cond} onChange={(ev) => setCond(ev.target.value)}><option>Good</option><option>Minor wear</option><option>Damaged / torn pages</option><option>Water damaged</option></select>
          </Field>
          <Field label="Route to"><input readOnly value={`Document intake (${got.length} document${got.length === 1 ? '' : 's'})`} /></Field>
        </div>
        <Field label="Remarks" hint={miss.length || cond !== 'Good' ? 'A mismatch or damage automatically raises an exception for the supervisor.' : 'Optional'}>
          <textarea rows={2} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} />
        </Field>
        {(miss.length > 0 && got.length > 0) && <div className="callout bad"><Icon name="FileWarning" size={16} /><div>{miss.length} listed item(s) not found in the file — will be flagged as a handover mismatch.</div></div>}
        <div className="row-end">
          <Button icon="Undo2" onClick={() => setRet(true)}>Return to ward</Button>
          <Button variant="primary" icon="PackageCheck" onClick={accept} disabled={!identity}>Accept into MRD</Button>
        </div>
      </Card>
      <Modal open={ret} onClose={() => setRet(false)} title="Return file to ward" subtitle="Use when the file belongs to another patient or is unacceptable."
        footer={<><Button onClick={() => setRet(false)}>Cancel</Button><Button variant="danger" onClick={() => { if (run('RETURN_HANDOVER', { ip: e.ip, reason }, 'File returned to ward').ok) setRet(false) }}>Return to ward</Button></>}>
        <Field label="Reason" required><textarea rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="e.g. File cover shows a different UHID" /></Field>
      </Modal>
    </div>
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
