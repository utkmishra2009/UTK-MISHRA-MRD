import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { checklistTypes, docType, currentUser } from '../data/catalog'
import { H, docsOf, fmtShort, patientOf, stageOf, fmtDT } from '../lib/logic'
import { MobileBack } from '../components/ui'
import { PageHead, Tabs, Table, Badge, Tat, Mono, Empty, PatientBanner, Card, Button, Field, Modal, Icon, Hint, Sim, SearchBox } from '../components/ui'

const OPTIONAL = ['TPR', 'IO', 'OTH']

export default function Handover() {
  const { s, nav, run } = useStore()
  const params = s.route.params || {}
  const [tab, setTab] = useState(params.tab || 'todo')
  const [q, setQ] = useState('')
  const sel = params.ip
  const live = s.encounters.filter((e) => !e.archive)
  const name = (u) => patientOf(s, u)?.name || ''
  const match = (e) => !q || [name(e.uhid), e.uhid, e.ip, e.ward].some((v) => v.toLowerCase().includes(q.toLowerCase()))
  const todo = live.filter((e) => stageOf(s, e).key === 'handover' && match(e)).sort((a, b) => a.discharged - b.discharged)
  const sent = live.filter((e) => e.handover && e.handover.at > s.now - 24 * 14 * H && match(e)).sort((a, b) => b.handover.at - a.handover.at)
  const adm = live.filter((e) => !e.discharged && match(e))
  useEffect(() => { if (params.tab) setTab(params.tab) }, [params.tab])
  const [disType, setDisType] = useState('Normal')
  const [simFor, setSimFor] = useState(null)

  const selEnc = sel && s.encounters.find((e) => e.ip === sel)

  return (
    <div className="page">
      <PageHead kicker="Ward → MRD" title="Discharge record handover" info="Patients appear here automatically when the hospital system records a discharge. Check the file, confirm what you are sending, and submit it to MRD." />
      <div className={`split ${selEnc ? 'has-detail' : ''}`}>
        <div className="split-list">
          <SearchBox value={q} onChange={setQ} placeholder="Search patient, UHID, IP no., ward" />
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'todo', label: 'To hand over', count: todo.length }, { id: 'sent', label: 'Sent', count: sent.length }, { id: 'admitted', label: 'Admitted', count: adm.length }]} />
          {tab === 'todo' && (
            <Table rows={todo} rowKey={(e) => e.ip} onRow={(e) => nav('handover', { ip: e.ip, tab })} rowClass={(e) => (e.ip === sel ? 'sel' : '')}
              cols={[
                { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.ip}</Mono> · {e.ward}</small></div> },
                { label: 'Discharged', render: (e) => <span>{fmtShort(e.discharged)}{e.dischargeType !== 'Normal' && <Badge tone="warn">{e.dischargeType}</Badge>}</span> },
                { label: 'TAT', render: (e) => <Tat due={e.discharged + s.config.tat.handover * H} now={s.now} /> },
              ]}
              empty={<Empty icon="CircleCheck" title="No pending handovers">Simulate a discharge from the Admitted tab to see a new patient arrive here.</Empty>} />
          )}
          {tab === 'sent' && (
            <Table rows={sent} rowKey={(e) => e.ip} onRow={(e) => nav('handover', { ip: e.ip, tab })} rowClass={(e) => (e.ip === sel ? 'sel' : '')}
              cols={[
                { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.handover.ref}</Mono></small></div> },
                { label: 'Sent', render: (e) => fmtShort(e.handover.at) },
                { label: 'MRD status', render: (e) => <Badge>{e.handover.status === 'Submitted' ? 'Awaiting MRD receipt' : 'Received'}</Badge> },
              ]} empty={<Empty title="Nothing sent recently" />} />
          )}
          {tab === 'admitted' && (
            <>
              <Hint>In a live hospital admissions and discharges come from the HIS ADT feed. Here you can <b>simulate</b> them to create fresh patients to work on.</Hint>
              <div className="row-end"><Button size="sm" icon="Plus" onClick={() => run('SIM_ADMIT', {}, (st) => `New admission created – ${st.lastRef}`)}>Simulate new admission</Button></div>
              <Table rows={adm} rowKey={(e) => e.ip}
                cols={[
                  { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.ip}</Mono> · {e.ward} / {e.bed}</small></div> },
                  { label: 'Admitted', render: (e) => fmtShort(e.admitted) },
                  { label: '', render: (e) => <Button size="sm" icon="LogOut" onClick={(ev) => { ev.stopPropagation(); setSimFor(e) }}>Simulate discharge</Button> },
                ]} empty={<Empty title="No admitted patients in your wards" />} />
            </>
          )}
        </div>
        <div className="split-detail"><MobileBack />
          {selEnc ? <HandoverForm key={selEnc.ip} e={selEnc} onClose={() => nav('handover', { tab })} /> : <Empty icon="ClipboardList" title="Select a patient">Choose a discharged patient from the list to review and hand over their records.</Empty>}
        </div>
      </div>
      <Modal open={!!simFor} onClose={() => setSimFor(null)} title="Simulate ADT discharge" subtitle={simFor && `${name(simFor.uhid)} · ${simFor.ip}`}
        footer={<><Button onClick={() => setSimFor(null)}>Cancel</Button><Button variant="primary" icon="Check" onClick={() => { run('SIM_DISCHARGE', { ip: simFor.ip, dischargeType: disType }, 'Discharge recorded – patient added to handover worklist'); nav('handover', { ip: simFor.ip, tab: 'todo' }); setTab('todo'); setSimFor(null) }}>Record discharge</Button></>}>
        <Field label="Discharge type" hint="DAMA and Death add the DAMA form / Death summary to the required checklist.">
          <select value={disType} onChange={(e) => setDisType(e.target.value)}><option>Normal</option><option>DAMA</option><option>Death</option><option>Transfer</option></select>
        </Field>
        <p className="muted small"><Sim>Simulated HIS ADT event</Sim> The discharge summary, initial assessment and lab reports will be “received” from EMR/LIS automatically.</p>
      </Modal>
    </div>
  )
}

function HandoverForm({ e, onClose }) {
  const { s, run } = useStore()
  const p = patientOf(s, e.uhid)
  const electronic = docsOf(s, e.ip).filter((d) => d.kind === 'electronic')
  const physTypes = useMemo(() => [...new Set([...checklistTypes(e).filter((t) => docType(t).src === 'Physical'), ...OPTIONAL])], [e])
  const required = checklistTypes(e)
  const [items, setItems] = useState(() => Object.fromEntries(physTypes.map((t) => [t, { on: !OPTIONAL.includes(t) || t === 'TPR', pages: docType(t).pages || 1 }])))
  const [eConf, setEConf] = useState(() => Object.fromEntries(electronic.map((d) => [d.id, true])))
  const [carrier, setCarrier] = useState('Ward attendant – Suresh More')
  const [remarks, setRemarks] = useState('')
  const [done, setDone] = useState(null)
  const missingElectronic = required.filter((t) => docType(t).src !== 'Physical' && !electronic.some((d) => d.type === t))
  const missing = [...physTypes.filter((t) => required.includes(t) && !items[t].on), ...missingElectronic]

  const doneModal = (
    <Modal open={!!done} onClose={() => setDone(null)} title="Handover submitted" footer={<Button variant="primary" onClick={() => setDone(null)}>Done</Button>}>
        <div className="success-big"><Icon name="CircleCheck" size={36} /><div><small>Handover reference</small><strong className="mono">{done}</strong></div></div>
        <p>{p.name}’s records are now in MRD’s receiving queue. The physical file status is <b>In transit</b> until MRD accepts it.</p>
      </Modal>
  )
  if (e.handover) {
    const h = e.handover
    return (
      <div className="detail">
        <PatientBanner ip={e.ip} actions={<Button size="sm" icon="X" onClick={onClose} aria-label="Close" />} />
        <Card title={`Handover ${h.ref}`} icon="PackageCheck">
          <dl className="dl">
            <dt>Submitted</dt><dd>{fmtDT(h.at)} by {h.by}</dd>
            <dt>Status</dt><dd><Badge>{h.status === 'Submitted' ? 'Awaiting MRD receipt' : 'Received'}</Badge>{h.receivedAt && <span className="muted"> · {fmtDT(h.receivedAt)} by {h.receivedBy}</span>}</dd>
            <dt>Physical items</dt><dd>{h.items.map((it) => `${docType(it.type).name} (${it.pages}p)`).join(', ') || '—'}</dd>
            <dt>Electronic</dt><dd>{h.electronic.length} document(s) confirmed</dd>
            <dt>Missing</dt><dd>{h.missing.length ? h.missing.map((m) => <Badge key={m} tone="bad">{docType(m).name}</Badge>) : 'None'}</dd>
            {h.remarks && <><dt>Remarks</dt><dd>{h.remarks}</dd></>}
          </dl>
        </Card>
        {doneModal}
      </div>
    )
  }

  const submit = () => {
    const res = run('SUBMIT_HANDOVER', {
      ip: e.ip,
      items: physTypes.filter((t) => items[t].on).map((t) => ({ type: t, pages: Number(items[t].pages) || 1 })),
      electronic: electronic.filter((d) => eConf[d.id]).map((d) => d.id),
      missing, remarks, carrier,
    })
    if (res.ok) setDone(res.state.lastRef)
  }

  return (
    <div className="detail">
      <PatientBanner ip={e.ip} actions={<Button size="sm" icon="X" onClick={onClose} aria-label="Close" />} />
      <Card title="1 · Electronic documents already received" icon="Database" actions={<Sim>From EMR / LIS / RIS</Sim>}>
        <p className="muted small">These arrived automatically from hospital systems. Confirm they belong to this admission.</p>
        <ul className="checks">
          {electronic.map((d) => (
            <li key={d.id}><label><input type="checkbox" checked={eConf[d.id]} onChange={(ev) => setEConf({ ...eConf, [d.id]: ev.target.checked })} />
              <span>{docType(d.type).name}</span><Badge tone="info" dot={false}>{d.source}</Badge><small className="muted">{fmtShort(d.receivedAt)}</small></label></li>
          ))}
          {missingElectronic.map((t) => <li key={t} className="miss"><Icon name="TriangleAlert" size={14} /><span>{docType(t).name}</span><Badge tone="bad">Not received</Badge></li>)}
        </ul>
      </Card>
      <Card title="2 · Physical file checklist" icon="ListChecks">
        <p className="muted small">Tick what is physically in the file. Unticking a <b>required</b> item marks it as missing.</p>
        <ul className="checks checks-pages">
          {physTypes.map((t) => {
            const req = required.includes(t)
            return (
              <li key={t} className={!items[t].on && req ? 'miss' : ''}>
                <label><input type="checkbox" checked={items[t].on} onChange={(ev) => setItems({ ...items, [t]: { ...items[t], on: ev.target.checked } })} />
                  <span>{docType(t).name}</span>{req ? <Badge tone="mute" dot={false}>Required</Badge> : <small className="muted">optional</small>}</label>
                {items[t].on && <span className="pages-in"><input type="number" min="1" max="99" value={items[t].pages} aria-label={`${docType(t).name} pages`} onChange={(ev) => setItems({ ...items, [t]: { ...items[t], pages: ev.target.value } })} /> pages</span>}
                {!items[t].on && req && <Badge tone="bad">Missing</Badge>}
              </li>
            )
          })}
        </ul>
      </Card>
      <Card title="3 · Handover details" icon="Truck">
        <div className="form-grid">
          <Field label="Handed over by"><input value={currentUser(s).name} readOnly /></Field>
          <Field label="Carried to MRD by"><input value={carrier} onChange={(ev) => setCarrier(ev.target.value)} /></Field>
        </div>
        <Field label="Remarks" required={missing.length > 0} hint={missing.length ? `Explain the ${missing.length} missing item(s) — e.g. retained by OT, sent separately.` : 'Optional'}>
          <textarea rows={2} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} placeholder={missing.length ? 'Why is it missing? Who will send it?' : 'Anything MRD should know'} />
        </Field>
        {missing.length > 0 && <div className="callout warn"><Icon name="TriangleAlert" size={16} /><div><b>{missing.length} required document(s) missing:</b> {missing.map((m) => docType(m).name).join(', ')}. MRD will see this and can raise a deficiency.</div></div>}
        <div className="row-end"><Button variant="primary" icon="Send" onClick={submit}>Submit to MRD</Button></div>
      </Card>
      {doneModal}
    </div>
  )
}
