import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { docType, DOC_TYPES, FOLDERS } from '../data/catalog'
import { H, fmtShort, fmtDT, patientOf, toLocalInput, fromLocalInput, encOf } from '../lib/logic'
import { MobileBack } from '../components/ui'
import { PageHead, Tabs, Table, Badge, Tat, Mono, Empty, PatientBanner, Card, Button, Field, Icon, Hint, Sim, SearchBox, Modal } from '../components/ui'
import { DocViewer } from '../components/DocPage'

const DEFECTS = [['', 'No defect (clean scan)'], ['blur', 'Out of focus page'], ['cut', 'Cut-off edge'], ['rotated', 'Page fed sideways'], ['blank', 'Blank page fed'], ['wrongpt', 'Page from another patient']]

export default function Scanning() {
  const { s, nav } = useStore()
  const params = s.route.params || {}
  const [tab, setTab] = useState(params.tab || 'scan')
  useEffect(() => { if (params.tab) setTab(params.tab) }, [params.tab])
  const [q, setQ] = useState('')
  const name = (u) => patientOf(s, u)?.name || ''
  const m = (ip) => { const e = encOf(s, ip); return !q || [name(e.uhid), e.uhid, e.ip].some((v) => v.toLowerCase().includes(q.toLowerCase())) }
  const wait = s.documents.filter((d) => d.status === 'Awaiting Scan')
  const rework = s.documents.filter((d) => d.status === 'QC Rejected')
  const done = s.documents.filter((d) => d.kind === 'scanned' && d.receivedAt && d.receivedAt > s.now - 48 * H && d.status !== 'Awaiting Scan').sort((a, b) => b.receivedAt - a.receivedAt)
  const groups = (list) => [...new Set(list.map((d) => d.ip))].filter(m).map((ip) => encOf(s, ip))
  const selIp = params.ip

  return (
    <div className="page">
      <PageHead kicker="Digitization" title="Quick scan & QC rework" info="Scan one expected document at a time, or fix pages rejected by QC. For a whole received file — or an uploaded / outside document — use Document Intake.">
        <Button variant="primary" icon="FileScan" onClick={() => nav('intake', {})}>Open Document Intake</Button>
      </PageHead>
      <Tabs value={tab} onChange={(t) => { setTab(t); nav('scanning', { tab: t, ip: selIp }) }} tabs={[
        { id: 'scan', label: 'Quick scan by item', icon: 'ScanLine', count: wait.length },
        { id: 'rework', label: 'QC rework', icon: 'RefreshCw', count: rework.length },
        { id: 'done', label: 'Recently scanned', icon: 'FileScan', count: done.length },
      ]} />
      {tab === 'scan' && (
        <div className={`split ${selIp ? 'has-detail' : ''}`}>
          <div className="split-list">
            <SearchBox value={q} onChange={setQ} />
            <Table rows={groups(wait)} rowKey={(e) => e.ip} onRow={(e) => nav('scanning', { ip: e.ip, tab: 'scan' })} rowClass={(e) => (e.ip === selIp ? 'sel' : '')}
              cols={[
                { label: 'Patient file', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.fileId}</Mono> · {e.dept}</small></div> },
                { label: 'Docs', render: (e) => wait.filter((d) => d.ip === e.ip).length },
                { label: 'TAT', render: (e) => <Tat due={e.handover.receivedAt + s.config.tat.scanning * H} now={s.now} /> },
              ]} empty={<Empty icon="CircleCheck" title="Nothing to scan">Files appear here once MRD receiving accepts them.</Empty>} />
          </div>
          <div className="split-detail"><MobileBack />{selIp && encOf(s, selIp) ? <ScanStation key={selIp} ip={selIp} /> : <Empty icon="ScanLine" title="Select a patient file" />}</div>
        </div>
      )}
      {tab === 'rework' && (
        <div className={`split ${selIp ? 'has-detail' : ''}`}>
          <div className="split-list">
            <Table rows={rework.filter((d) => m(d.ip))} onRow={(d) => nav('scanning', { ip: d.ip, tab: 'rework' })} rowClass={(d) => (d.ip === selIp ? 'sel' : '')}
              cols={[
                { label: 'Document', render: (d) => <div className="cell-pt"><strong>{docType(d.type).name}</strong><small>{name(d.uhid)} · <Mono>{d.id}</Mono></small></div> },
                { label: 'Rejected', render: (d) => <span>{fmtShort(d.qc.at(-1)?.at)}<small className="block muted">{d.qc.at(-1)?.by}</small></span> },
              ]} empty={<Empty icon="CircleCheck" title="No rework pending" />} />
          </div>
          <div className="split-detail"><MobileBack />{selIp && rework.some((d) => d.ip === selIp) ? <Rework key={selIp} doc={rework.find((d) => d.ip === selIp)} /> : <Empty icon="RefreshCw" title="Select a rejected document" />}</div>
        </div>
      )}
      {tab === 'done' && (
        <Table rows={done} onRow={(d) => nav('patient', { ip: d.ip, tab: 'docs' })}
          cols={[
            { label: 'Scanned', render: (d) => fmtShort(d.receivedAt) },
            { label: 'Document', render: (d) => <span>{docType(d.type).name}{d.version > 1 && <Badge tone="warn">r{d.version}</Badge>}</span> },
            { label: 'Patient', render: (d) => <div className="cell-pt"><strong>{name(d.uhid)}</strong><small><Mono>{d.ip}</Mono></small></div> },
            { label: 'Pages', render: (d) => d.pages.length },
            { label: 'Physical source', render: (d) => <Mono>{d.fileId || '—'}</Mono> },
            { label: 'Status', render: (d) => <Badge>{d.status}</Badge> },
          ]} empty={<Empty title="Nothing scanned in the last 48 h" />} />
      )}
    </div>
  )
}

function ScanStation({ ip }) {
  const { s, run } = useStore()
  const e = encOf(s, ip)
  const p = patientOf(s, e.uhid)
  const docs = s.documents.filter((d) => d.ip === ip && d.kind === 'scanned')
  const wait = docs.filter((d) => d.status === 'Awaiting Scan')
  const [confirmed, setConfirmed] = useState(false)
  const [cur, setCur] = useState(wait[0]?.id)
  const d = docs.find((x) => x.id === cur) || wait[0]
  const [form, setForm] = useState({})
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (d) setForm({ type: d.type, folder: docType(d.type).folder, docDate: toLocalInput(d.docDate || e.discharged), pages: d.expectedPages || 2, defect: '', defectPage: 2 })
    setPreview(null)
  }, [d?.id])

  const scan = () => {
    if (!confirmed) return run('SCAN_DOC', { id: d.id, confirmed: false })
    setBusy(true)
    setTimeout(() => {
      const n = Math.max(1, Number(form.pages) || 1)
      const dp = Math.min(Number(form.defectPage) || 1, n)
      setPreview({ ...d, type: form.type, pages: Array.from({ length: n }, (_, i) => ({ n: i + 1, defect: form.defect && dp === i + 1 ? form.defect : null, rot: form.defect === 'rotated' && dp === i + 1 ? 90 : 0 })) })
      setBusy(false)
    }, 700)
  }
  const send = () => {
    const r = run('SCAN_DOC', { id: d.id, confirmed, pages: form.pages, defect: form.defect || null, defectPage: Number(form.defectPage), type: form.type, folder: form.folder, docDate: fromLocalInput(form.docDate) }, `${docType(form.type).name} sent to QC`)
    if (r.ok) { setPreview(null); const next = r.state.documents.find((x) => x.ip === ip && x.status === 'Awaiting Scan'); setCur(next?.id) }
  }
  const scanAll = () => {
    if (!confirmed) return run('SCAN_DOC', { id: wait[0].id, confirmed: false })
    wait.forEach((w) => run('SCAN_DOC', { id: w.id, confirmed: true, pages: w.expectedPages }))
    run('NAV', { page: 'scanning', params: { ip, tab: 'scan' } }, `${wait.length} document(s) scanned & sent to QC`)
  }

  return (
    <div className="detail">
      <PatientBanner ip={ip} />
      <label className={`bigcheck ${confirmed ? 'on' : 'attn'}`}><input type="checkbox" checked={confirmed} onChange={(ev) => setConfirmed(ev.target.checked)} />
        <span><b>I confirm this is {p.name} ({e.uhid}), admission {e.ip}</b><small>Required before scanning — prevents documents being filed to the wrong patient.</small></span></label>
      <div className="doc-chips">
        {docs.map((x) => (
          <button key={x.id} className={`doc-chip ${x.id === d?.id ? 'on' : ''}`} onClick={() => x.status === 'Awaiting Scan' && setCur(x.id)} disabled={x.status !== 'Awaiting Scan'}>
            <Icon name={x.status === 'Awaiting Scan' ? 'FileText' : 'CircleCheck'} size={14} />{docType(x.type).name}<Badge dot={false}>{x.status}</Badge>
          </button>
        ))}
      </div>
      {wait.length > 1 && <div className="row-end"><Button size="sm" icon="FastForward" onClick={scanAll}>Scan all {wait.length} (clean scans)</Button></div>}
      {d && d.status === 'Awaiting Scan' ? (
        <Card title={`Index & scan · ${docType(d.type).name}`} icon="ScanLine" actions={<Sim>Simulated scanner</Sim>}>
          <div className="form-grid g3">
            <Field label="Document type" required><select value={form.type || ''} onChange={(ev) => setForm({ ...form, type: ev.target.value, folder: docType(ev.target.value).folder })}>{DOC_TYPES.filter((t) => t.src === 'Physical').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <Field label="Folder / classification tag" required><select value={form.folder || ''} onChange={(ev) => setForm({ ...form, folder: ev.target.value })}>{FOLDERS.map((f) => <option key={f}>{f}</option>)}</select></Field>
            <Field label="Document (clinical) date" hint="Stored separately from scan time"><input type="datetime-local" value={form.docDate || ''} onChange={(ev) => setForm({ ...form, docDate: ev.target.value })} /></Field>
            <Field label="Pages" hint={`Handover listed ${d.expectedPages}`}><input type="number" min="1" max="40" value={form.pages || ''} onChange={(ev) => setForm({ ...form, pages: ev.target.value })} /></Field>
            <Field label="Encounter"><input readOnly value={`${e.ip} · ${e.dept}`} /></Field>
            <Field label="Physical source"><input readOnly value={`${e.fileId} (vol. 1)`} /></Field>
          </div>
          <details className="demo-ctl">
            <summary><Icon name="Monitor" size={13} /> Demo control: simulate a scanner problem</summary>
            <div className="form-grid">
              <Field label="Defect"><select value={form.defect} onChange={(ev) => setForm({ ...form, defect: ev.target.value })}>{DEFECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="On page"><input type="number" min="1" value={form.defectPage} onChange={(ev) => setForm({ ...form, defectPage: ev.target.value })} /></Field>
            </div>
          </details>
          {!preview && <div className="row-end"><Button variant="primary" icon="Scan" onClick={scan} disabled={busy}>{busy ? 'Scanning…' : 'Scan'}</Button></div>}
          {busy && <div className="scanning-bar"><span /></div>}
          {preview && (
            <>
              <DocViewer doc={preview} patient={p} enc={e} />
              <div className="row-end"><Button icon="RefreshCw" onClick={() => setPreview(null)}>Rescan</Button><Button variant="primary" icon="Send" onClick={send}>Send to QC</Button></div>
            </>
          )}
        </Card>
      ) : (
        <Empty icon="CircleCheck" title="All documents for this file are scanned">They are now with the QC reviewer.</Empty>
      )}
    </div>
  )
}

function Rework({ doc }) {
  const { s, run } = useStore()
  const e = encOf(s, doc.ip)
  const p = patientOf(s, doc.uhid)
  const last = doc.qc.at(-1)
  const bad = doc.pages.filter((pg) => pg.mark && pg.mark !== 'Clear')
  return (
    <div className="detail">
      <PatientBanner ip={doc.ip} />
      <div className="callout bad"><Icon name="ShieldCheck" size={16} /><div><b>Rejected by {last?.by} · {fmtDT(last?.at)}</b><br />“{last?.remarks}”{bad.length > 0 && <><br />Flagged pages: {bad.map((pg) => `p${pg.n} (${pg.mark})`).join(', ')}</>}</div></div>
      <Card title={`${docType(doc.type).name} · ${doc.id}`} icon="RefreshCw">
        <DocViewer doc={doc} patient={p} enc={e} initial={Math.max(0, (bad[0]?.n || 1) - 1)} markOf={(pg) => pg.mark}
          pageTools={(pg) => (
            <div className="pt-row">
              <span className="small">Page {pg.n}: {pg.mark ? <Badge>{pg.mark === 'Clear' ? 'Clear' : pg.mark}</Badge> : 'not flagged'}{pg.replaced ? <Badge tone="ok">Rescanned</Badge> : null}</span>
              <span className="sp" />
              <Button size="sm" icon="RotateCw" onClick={() => run('PAGE_FIX', { id: doc.id, n: pg.n, action: 'rotate' })}>Rotate page</Button>
              <Button size="sm" icon="Replace" variant="primary" onClick={() => run('PAGE_FIX', { id: doc.id, n: pg.n, action: 'replace' }, `Page ${pg.n} rescanned`)}>Rescan / replace page</Button>
            </div>
          )} />
        <div className="row-end"><Button variant="primary" icon="Send" onClick={() => run('RESUBMIT', { id: doc.id }, 'Corrected document resubmitted to QC')}>Resubmit to QC</Button></div>
      </Card>
      <Card title="Rework history" icon="History">
        <ul className="hist">{doc.qc.map((x, i) => <li key={i}><Badge>{x.decision === 'Approved' ? 'Approved' : 'Rejected'}</Badge> {fmtDT(x.at)} · {x.by} — {x.remarks}</li>)}</ul>
      </Card>
    </div>
  )
}

