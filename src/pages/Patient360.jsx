import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { docType, FOLDERS } from '../data/catalog'
import { STAGES, stageOf, nextAction, checklist, docsOf, fileOf, fileStatus, fmtDT, fmtShort, patientOf, encOf, reqTat } from '../lib/logic'
import { PageHead, Table, Badge, Mono, Empty, PatientBanner, Card, Button, Field, Icon, Tabs, Steps, Timeline, Modal, Tat } from '../components/ui'
import { DocViewer } from '../components/DocPage'
import { LocationTrail } from './Storage'

export default function Patient360() {
  const { s, nav, run } = useStore()
  const params = s.route.params || {}
  const e = encOf(s, params.ip)
  const [tab, setTab] = useState(params.tab || 'overview')
  useEffect(() => { if (params.tab) setTab(params.tab) }, [params.tab, params.ip])
  const [doc, setDoc] = useState(null)
  const [reopen, setReopen] = useState(false)
  const [why, setWhy] = useState('')
  if (!e) return <div className="page"><Empty icon="Search" title="Record not found" action={<Button onClick={() => nav('search')}>Search records</Button>} /></div>
  const p = patientOf(s, e.uhid)
  const st = stageOf(s, e)
  const [who, what] = nextAction(s, e)
  const docs = docsOf(s, e.ip)
  const f = fileOf(s, e.fileId)
  const reqs = s.requests.filter((r) => r.ip === e.ip)
  const events = s.audit.filter((a) => a.ip === e.ip || (a.uhid === e.uhid && !a.ip)).slice().reverse()
  const cl = checklist(s, e)
  const otherEnc = s.encounters.filter((x) => x.uhid === e.uhid && x.ip !== e.ip)

  return (
    <div className="page">
      <PageHead kicker="Patient record 360°" title={p.name} info="Everything that happened to this admission’s medical record: who handled it, where it is now, and what must happen next.">
        <Button icon="ArrowLeft" onClick={() => nav('search')}>All records</Button>
        {e.record.status === 'Closed' && s.role === 'supervisor' && <Button icon="Undo2" onClick={() => setReopen(true)}>Reopen record</Button>}
      </PageHead>
      <PatientBanner ip={e.ip} />
      <Card className="card-life">
        <Steps steps={STAGES} current={st.step + 1} />
        <div className="next">
          <Icon name="ArrowRight" size={16} />
          <div><small>Next step · {who}</small><p>{what}</p></div>
          <div className="next-where">
            <small>Physical file</small>
            <strong>{f ? fileStatus(s, f) : 'Not yet with MRD'}</strong>
            <span className="small muted">{f?.location ? `${f.location.room === 'A' ? 'Room A' : 'Room B'} › R${f.location.rack} › S${f.location.shelf} › P${f.location.pos}` : f?.custodian || e.ward}</span>
          </div>
        </div>
      </Card>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview', icon: 'Gauge' },
        { id: 'docs', label: 'Documents', icon: 'Files', count: docs.length },
        { id: 'file', label: 'Physical file', icon: 'FolderOpen' },
        { id: 'complete', label: 'Completeness & coding', icon: 'ListChecks' },
        { id: 'requests', label: 'Requests', icon: 'Send', count: reqs.length },
        { id: 'timeline', label: 'Audit timeline', icon: 'History', count: events.length },
      ]} />
      {tab === 'overview' && (
        <div className="grid3">
          <Card title="Encounter" icon="Hospital"><dl className="dl"><dt>Ward / bed</dt><dd>{e.ward} / {e.bed}</dd><dt>Consultant</dt><dd>{e.consultant}</dd><dt>Discharge type</dt><dd>{e.discharged ? e.dischargeType : '—'}</dd><dt>Diagnosis</dt><dd>{e.diagnosis}</dd>{otherEnc.length > 0 && <><dt>Other admissions</dt><dd>{otherEnc.map((x) => <button key={x.ip} className="linklike" onClick={() => nav('patient', { ip: x.ip })}>{x.ip}</button>)}</dd></>}</dl></Card>
          <Card title="Handover & receipt" icon="Truck">{e.handover ? <dl className="dl"><dt>Reference</dt><dd><Mono>{e.handover.ref}</Mono></dd><dt>Sent</dt><dd>{fmtDT(e.handover.at)} · {e.handover.by}</dd><dt>Received</dt><dd>{e.handover.receivedAt ? `${fmtDT(e.handover.receivedAt)} · ${e.handover.receivedBy}` : <Badge>Awaiting MRD receipt</Badge>}</dd><dt>Missing at handover</dt><dd>{e.handover.missing.length ? e.handover.missing.map((m) => docType(m).name).join(', ') : 'None'}</dd></dl> : <Empty icon="ClipboardList" title="Not handed over yet" />}</Card>
          <Card title="Record & coding" icon="FileCheck2"><dl className="dl"><dt>Record status</dt><dd><Badge>{e.record.status}</Badge></dd><dt>Checklist</dt><dd>{cl.filter((c) => c.state === 'present' || c.state === 'waived').length}/{cl.length} items</dd><dt>ICD-10</dt><dd>{e.coding.codes.length ? e.coding.codes.map((c) => <div key={c.code}><Mono>{c.code}</Mono> {c.desc}</div>) : '—'}</dd>{e.record.closedAt && <><dt>Closed</dt><dd>{fmtDT(e.record.closedAt)} · {e.record.closedBy}</dd></>}</dl></Card>
        </div>
      )}
      {tab === 'docs' && (
        <div className="folders">
          {FOLDERS.map((fd) => {
            const list = docs.filter((d) => (d.folder || docType(d.type).folder) === fd)
            if (!list.length) return null
            return (
              <Card key={fd} title={fd} icon="Folder" actions={<span className="small muted">{list.length} document(s)</span>}>
                <Table rows={list} onRow={(d) => d.pages.length && setDoc(d)} cols={[
                  { label: 'Document', render: (d) => <span><strong>{docType(d.type).name}</strong>{d.lateEntry && <Badge tone="bad">Late Entry</Badge>}</span> },
                  { label: 'Source', render: (d) => <Badge tone="info" dot={false}>{d.kind === 'scanned' ? `Scanned · ${d.fileId || 'upload'}` : d.source}</Badge> },
                  { label: 'Doc date', render: (d) => fmtShort(d.docDate) },
                  { label: 'Pages', render: (d) => d.pages.length || '—' },
                  { label: 'Status', render: (d) => <Badge>{d.status}</Badge> },
                  { label: 'QC', render: (d) => (d.qc.length ? <small>{d.qc.at(-1).decision} · {d.qc.at(-1).by}{d.qc.length > 1 && ` · ${d.qc.length} reviews`}</small> : <small className="muted">{d.kind === 'electronic' ? 'Authorised at source' : '—'}</small>) },
                ]} />
              </Card>
            )
          })}
          {!docs.length && <Empty title="No documents yet" />}
        </div>
      )}
      {tab === 'file' && (
        <Card title={f ? `Physical file ${f.id}` : 'Physical file'} icon="FolderOpen">
          {f ? <>
            <LocationTrail loc={f.location} status={fileStatus(s, f)} />
            <dl className="dl"><dt>Custodian</dt><dd>{f.custodian || 'MRD'}</dd>{f.issue && <><dt>On loan</dt><dd>{f.issue.to} ({f.issue.dept}) since {fmtDT(f.issue.at)} · due {fmtDT(f.issue.expectedReturn)}</dd></>}</dl>
            <h4 className="list-h">Movement history</h4>
            {f.history.length ? <ul className="hist">{f.history.slice().reverse().map((h, i) => <li key={i}>{fmtDT(h.at)} · {h.by} — {h.action}</li>)}</ul> : <p className="small muted">No movements recorded since storage.</p>}
            <div className="row-end"><Button icon="Archive" onClick={() => nav('storage', { file: f.id })}>Open in storage map</Button></div>
          </> : <Empty icon="FolderOpen" title="Physical file not yet with MRD">{e.ward}</Empty>}
        </Card>
      )}
      {tab === 'complete' && (
        <Card title="Completeness checklist" icon="ListChecks" actions={s.role === 'executive' || s.role === 'supervisor' ? <Button size="sm" onClick={() => nav('coding', { ip: e.ip })}>Open workbench</Button> : null}>
          <ul className="cl">{cl.map((c) => <li key={c.type} className={`cl-${c.state}`}><Icon name={c.state === 'present' ? 'CircleCheck' : c.state === 'waived' ? 'Ban' : c.state === 'processing' ? 'Clock' : 'CircleX'} size={17} /><div className="cl-main"><strong>{c.name}</strong><small>{c.folder}{c.deficiency && ` · deficiency ${c.deficiency.id}: ${c.deficiency.status}`}</small></div><Badge>{c.state === 'present' ? 'Present' : c.state === 'processing' ? 'In processing' : c.state === 'waived' ? 'Waived' : 'Missing'}</Badge></li>)}</ul>
        </Card>
      )}
      {tab === 'requests' && (
        <Table rows={reqs} onRow={(r) => nav(s.role === 'requester' ? 'myrequests' : 'desk', { req: r.id })} cols={[
          { label: 'Ref', render: (r) => <Mono>{r.id}</Mono> }, { label: 'Requester', render: (r) => `${r.requester} · ${r.dept}` }, { label: 'What', render: (r) => `${r.scope} · ${r.mode}` },
          { label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { label: 'TAT', render: (r) => { const t = reqTat(s, r); return t ? <Tat due={t.due} now={s.now} /> : fmtShort(r.createdAt) } },
        ]} empty={<Empty icon="Send" title="No requests for this record" />} />
      )}
      {tab === 'timeline' && <Card title="Lifecycle audit trail" icon="History" actions={<span className="small muted">Append-only · server time</span>}><Timeline items={events} /></Card>}
      <Modal open={!!doc} onClose={() => setDoc(null)} wide title={doc && docType(doc.type).name} subtitle={doc && `${doc.id} · ${doc.status} · ${doc.source}`}>
        {doc && <DocViewer doc={doc} patient={p} enc={e} markOf={(pg) => pg.mark} />}
      </Modal>
      <Modal open={reopen} onClose={() => setReopen(false)} title="Reopen closed record" footer={<><Button onClick={() => setReopen(false)}>Cancel</Button><Button variant="primary" onClick={() => { if (run('REOPEN', { ip: e.ip, reason: why }, 'Record reopened').ok) setReopen(false) }}>Reopen</Button></>}>
        <Field label="Reason" required><textarea rows={3} value={why} onChange={(ev) => setWhy(ev.target.value)} /></Field>
      </Modal>
    </div>
  )
}
