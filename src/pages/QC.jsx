import { useState } from 'react'
import { useStore } from '../store'
import { docType } from '../data/catalog'
import { fmtShort, fmtDT, patientOf, encOf } from '../lib/logic'
import { MobileBack } from '../components/ui'
import { PageHead, Table, Badge, Tat, Mono, Empty, PatientBanner, Card, Button, Field, Icon, Hint, SearchBox, Modal } from '../components/ui'
import { DocViewer } from '../components/DocPage'

const MARKS = [
  ['Clear', 'CircleCheck', 'ok'], ['Unclear', 'Eye', 'bad'], ['Incomplete page', 'Scan', 'bad'], ['Blank', 'ImageOff', 'bad'], ['Wrong orientation', 'RotateCw', 'bad'], ['Wrong patient', 'Fingerprint', 'bad'],
]

export default function QC() {
  const { s, nav } = useStore()
  const params = s.route.params || {}
  const [q, setQ] = useState('')
  const name = (u) => patientOf(s, u)?.name || ''
  const list = s.documents.filter((d) => d.status === 'QC Pending' && (!q || [name(d.uhid), d.uhid, d.ip, docType(d.type).name].some((v) => v.toLowerCase().includes(q.toLowerCase())))).sort((a, b) => a.receivedAt - b.receivedAt)
  let sel = params.doc && s.documents.find((d) => d.id === params.doc)
  if (!sel && params.ip) sel = s.documents.find((d) => d.ip === params.ip && d.kind === 'scanned' && (!params.type || d.type === params.type) && d.status === 'QC Pending') || s.documents.find((d) => d.ip === params.ip && d.kind === 'scanned' && d.type === params.type)
  return (
    <div className="page">
      <PageHead kicker="Quality check" title="Scanned document QC" info="Review every page: is it readable, complete, correctly oriented and for the right patient? Approve, or reject with remarks so scanning can fix it." />
      <div className={`split ${sel ? 'has-detail' : ''}`}>
        <div className="split-list">
          <SearchBox value={q} onChange={setQ} />
          <Table rows={list} onRow={(d) => nav('qc', { doc: d.id })} rowClass={(d) => (d.id === sel?.id ? 'sel' : '')}
            cols={[
              { label: 'Document', render: (d) => <div className="cell-pt"><strong>{docType(d.type).name}{d.version > 1 && <Badge tone="warn">Rework r{d.version}</Badge>}</strong><small>{name(d.uhid)} · <Mono>{d.ip}</Mono></small></div> },
              { label: 'Pages', render: (d) => d.pages.length },
              { label: 'TAT', render: (d) => <Tat due={d.receivedAt + s.config.tat.qc * 3600000} now={s.now} /> },
            ]} empty={<Empty icon="CircleCheck" title="QC queue is empty" />} />
        </div>
        <div className="split-detail"><MobileBack />{sel ? <Review key={sel.id + sel.version + sel.status} doc={sel} /> : <Empty icon="ShieldCheck" title="Select a document to review" />}</div>
      </div>
    </div>
  )
}

function Review({ doc }) {
  const { s, run, nav } = useStore()
  const e = encOf(s, doc.ip)
  const p = patientOf(s, doc.uhid)
  const [marks, setMarks] = useState({})
  const [remarks, setRemarks] = useState('')
  const [esc, setEsc] = useState(false)
  const [escR, setEscR] = useState('')
  const reviewed = Object.keys(marks).length
  const issues = Object.entries(marks).filter(([, v]) => v !== 'Clear')
  const pageGap = (doc.expectedPages || doc.pages.length) - doc.pages.length
  if (doc.status !== 'QC Pending') {
    return (
      <div className="detail">
        <PatientBanner ip={doc.ip} />
        <Card title={`${docType(doc.type).name} · ${doc.id}`} icon="ShieldCheck" actions={<Badge>{doc.status}</Badge>}>
          <DocViewer doc={doc} patient={p} enc={e} markOf={(pg) => pg.mark} />
          <h4 className="list-h">QC history</h4>
          <ul className="hist">{doc.qc.map((x, i) => <li key={i}><Badge>{x.decision}</Badge> r{x.version || 1} · {fmtDT(x.at)} · {x.by} — {x.remarks}</li>)}</ul>
          {doc.status === 'QC Rejected' && <p className="small muted">Waiting for the scanning operator to correct and resubmit.</p>}
        </Card>
      </div>
    )
  }
  const decide = (decision) => {
    const r = run('QC_DECIDE', { id: doc.id, decision, remarks, marks }, decision === 'Approved' ? 'Document approved – added to the patient record' : 'Document rejected – sent back to scanning')
    if (r.ok) nav('qc', {})
  }
  return (
    <div className="detail">
      <PatientBanner ip={doc.ip} compact />
      <Card title={`${docType(doc.type).name}`} icon="FileScan" actions={<span className="small muted"><Mono>{doc.id}</Mono> · scanned {fmtShort(doc.receivedAt)} by {doc.by}</span>}>
        <div className="qc-checks">
          <span className={pageGap > 0 ? 't-bad' : 't-ok'}><Icon name={pageGap > 0 ? 'TriangleAlert' : 'CircleCheck'} size={14} /> Pages: {doc.pages.length} scanned / {doc.expectedPages || doc.pages.length} listed at handover</span>
          <span><Icon name="Folder" size={14} /> Tag: {doc.folder || docType(doc.type).folder}</span>
          <span><Icon name="Package" size={14} /> Source: <Mono>{doc.fileId || 'upload'}</Mono></span>
          {doc.version > 1 && <span className="t-warn"><Icon name="RefreshCw" size={14} /> Rework r{doc.version}</span>}
        </div>
        <DocViewer doc={doc} patient={p} enc={e} markOf={(pg) => marks[pg.n]}
          pageTools={(pg) => (
            <div className="marks" role="group" aria-label={`Mark page ${pg.n}`}>
              <span className="small"><b>Page {pg.n}</b> is:</span>
              {MARKS.map(([m, ic, tone]) => (
                <button key={m} className={`mark mark-${tone} ${marks[pg.n] === m ? 'on' : ''}`} onClick={() => setMarks({ ...marks, [pg.n]: m })} aria-pressed={marks[pg.n] === m}><Icon name={ic} size={13} />{m}</button>
              ))}
            </div>
          )} />
        <div className="qc-foot">
          <div className="small">Reviewed <b>{reviewed}/{doc.pages.length}</b> pages{issues.length > 0 && <> · <b className="t-bad">{issues.length} issue(s)</b>: {issues.map(([n, v]) => `p${n} ${v}`).join(', ')}</>}
            {reviewed < doc.pages.length && <> · <button className="linklike" onClick={() => setMarks(Object.fromEntries(doc.pages.map((pg) => [pg.n, marks[pg.n] || 'Clear'])))}>mark remaining as Clear</button></>}</div>
          <Field label="QC remarks" required={issues.length > 0} hint="Mandatory when rejecting — tell the scanning operator exactly what to fix.">
            <textarea rows={2} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} placeholder={issues.length ? `e.g. Page ${issues[0][0]} ${issues[0][1].toLowerCase()} – please rescan` : 'Optional when approving'} />
          </Field>
          <Hint>QC decisions are made by the reviewer. The prototype does not perform automated image-quality detection.</Hint>
          <div className="row-end">
            <Button icon="Flag" onClick={() => setEsc(true)}>Escalate</Button>
            <Button variant="danger" icon="CircleX" onClick={() => decide('Rejected')} disabled={!issues.length && !remarks}>Reject & send back</Button>
            <Button variant="primary" icon="BadgeCheck" onClick={() => decide('Approved')} disabled={reviewed < doc.pages.length || issues.length > 0}>Approve</Button>
          </div>
        </div>
      </Card>
      {doc.qc.length > 0 && <Card title="Previous QC decisions" icon="History"><ul className="hist">{doc.qc.map((x, i) => <li key={i}><Badge>{x.decision}</Badge> r{x.version || 1} · {fmtDT(x.at)} · {x.by} — {x.remarks}</li>)}</ul></Card>}
      <Modal open={esc} onClose={() => setEsc(false)} title="Escalate to MRD supervisor" subtitle="For issues QC cannot resolve — e.g. original page torn, document belongs to another patient."
        footer={<><Button onClick={() => setEsc(false)}>Cancel</Button><Button variant="primary" onClick={() => { if (run('ESCALATE', { kind: 'QC issue', ref: doc.id, ip: doc.ip, page: 'qc', reason: escR }, 'Escalated to MRD supervisor').ok) setEsc(false) }}>Escalate</Button></>}>
        <Field label="Reason" required><textarea rows={3} value={escR} onChange={(ev) => setEscR(ev.target.value)} /></Field>
      </Modal>
    </div>
  )
}
