import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { DOC_TYPES, DOC_TAGS, FOLDERS, docType, canAccess } from '../data/catalog'
import { H, fmtDT, fmtShort, patientOf, encOf, searchRecords, toLocalInput, fromLocalInput } from '../lib/logic'
import { PageHead, Table, Badge, Tat, Mono, Empty, PatientBanner, Card, Button, Field, Icon, Hint, Sim, SearchBox, Modal, MobileBack } from '../components/ui'
import { PageSVG } from '../components/DocPage'

const COLORS = ['#2f7d6d', '#3b6ea8', '#7a5aa6', '#b06a1f', '#9c3d54', '#4d7c22', '#1d5c8c', '#a8452c']
const STEPS = [['Capture', 'Scan or upload pages'], ['Tag documents', 'Split pages into documents'], ['Map to patient file', 'Confirm UHID · IP · file'], ['Review & submit', 'Send to QC']]
const DEFECTS = [['', 'No defect'], ['blur', 'Out of focus page'], ['cut', 'Cut-off edge'], ['rotated', 'Page fed sideways'], ['blank', 'Blank sheet in feeder'], ['wrongpt', 'Page from another patient']]

export default function Intake() {
  const { s, nav, run } = useStore()
  const params = s.route.params || {}
  const name = (u) => patientOf(s, u)?.name || ''
  const ready = s.encounters.filter((e) => e.handover?.status === 'Received' && s.documents.some((d) => d.ip === e.ip && d.status === 'Awaiting Scan'))
  const drafts = s.batches.filter((b) => b.status === 'Draft')
  const done = s.batches.filter((b) => b.status === 'Submitted').sort((a, b) => b.submittedAt - a.submittedAt)
  const batch = params.batch === '__loose' ? s.batches.filter((b) => b.source !== 'Physical file').sort((a, b) => b.createdAt - a.createdAt)[0] : params.batch && s.batches.find((b) => b.id === params.batch)

  // Opening a received file (from a list, a link or the guide) opens / resumes its intake batch
  useEffect(() => {
    if ((params.ip || params.loose) && !params.batch) {
      const r = run('INTAKE_NEW', params.ip ? { ip: params.ip } : {})
      if (r.ok) run('NAV', { page: 'intake', params: { batch: r.state.lastRef } })
    }
  }, [params.ip, params.loose, params.batch])
  const openFile = (ip) => { const r = run('INTAKE_NEW', { ip }); if (r.ok) nav('intake', { batch: r.state.lastRef }) }
  const openLoose = () => { const r = run('INTAKE_NEW', {}, 'New intake batch for a loose / external document'); if (r.ok) nav('intake', { batch: r.state.lastRef }) }

  return (
    <div className="page">
      <PageHead kicker="Digitization · after MRD receipt" title="Document intake" info="Scan or upload the pages of a received file, group them into documents and tag each one, then map the batch to the patient’s file and send it to quality check.">
        <Button icon="Upload" onClick={openLoose}>Loose / external document</Button>
      </PageHead>
      <div className="intake-flow" aria-hidden>
        {['Physical file received in MRD', 'Capture: scan or upload', 'Tag pages into documents', 'Map to patient file', 'QC', 'Patient record'].map((x, i) => <span key={x}><b>{i + 1}</b>{x}</span>)}
      </div>
      <div className={`split split-intake ${batch ? 'has-detail' : ''}`}>
        <div className="split-list">
          <h4 className="list-h">Received files awaiting intake <em>{ready.length}</em></h4>
          <Table rows={ready} rowKey={(e) => e.ip} onRow={(e) => openFile(e.ip)} rowClass={(e) => (batch?.ip === e.ip ? 'sel' : '')}
            cols={[
              { label: 'Patient file', render: (e) => { const ph = s.documents.filter((d) => d.ip === e.ip && d.status === 'Awaiting Scan'); return <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.fileId}</Mono> · {ph.length} docs · {ph.reduce((a, d) => a + (d.expectedPages || 1), 0)} p</small></div> } },
              { label: 'Intake TAT', render: (e) => <span className="stack-r"><Tat due={e.handover.receivedAt + s.config.tat.scanning * H} now={s.now} />{s.batches.some((b) => b.ip === e.ip && b.status === 'Draft') && <Badge tone="warn">Draft open</Badge>}</span> },
            ]} empty={<Empty icon="CircleCheck" title="No received files waiting">Files appear here as soon as MRD receiving accepts a ward handover.</Empty>} />
          {drafts.filter((b) => b.source !== 'Physical file').length > 0 && <>
            <h4 className="list-h">Loose / external drafts</h4>
            <ul className="pick">{drafts.filter((b) => b.source !== 'Physical file').map((b) => <li key={b.id}><button className={batch?.id === b.id ? 'on' : ''} onClick={() => nav('intake', { batch: b.id })}><strong>{b.uhid ? name(b.uhid) : 'Not yet mapped'}</strong><small><Mono>{b.id}</Mono> · {b.pages.length} page(s) · {b.createdBy}</small><Badge>Draft</Badge></button></li>)}</ul>
          </>}
          <h4 className="list-h">Submitted batches <em>{done.length}</em></h4>
          {done.length ? <ul className="pick">{done.slice(0, 8).map((b) => <li key={b.id}><button className={batch?.id === b.id ? 'on' : ''} onClick={() => nav('intake', { batch: b.id })}><strong>{name(b.uhid)}</strong><small><Mono>{b.id}</Mono> · {b.docs.length} doc(s) · {fmtShort(b.submittedAt)}</small><Badge tone="ok">Submitted</Badge></button></li>)}</ul> : <p className="small muted">None yet.</p>}
        </div>
        <div className="split-detail"><MobileBack />
          {batch ? <Workspace key={batch.id + JSON.stringify(params) + (s.guide ? `${s.guide.id}-${s.guide.step}` : '')} b={batch} /> : (
            <div className="intake-start">
              <Empty icon="FileScan" title="Pick a received file, or start a loose document">
                A received file opens with its handover list, so you can match every scanned document to what the ward sent.
              </Empty>
              <div className="row-end" style={{ justifyContent: 'center' }}><Button variant="primary" icon="Upload" onClick={openLoose}>Upload a loose / external document</Button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Workspace({ b }) {
  const { s, run, nav } = useStore()
  const e = b.ip ? encOf(s, b.ip) : null
  const p = e ? patientOf(s, e.uhid) : null
  const placeholders = b.ip ? s.documents.filter((d) => d.ip === b.ip && d.status === 'Awaiting Scan') : []
  const tagged = new Set(b.docs.flatMap((d) => d.pageIds))
  const live = b.pages.filter((pg) => !pg.discarded)
  const untagged = live.filter((pg) => !tagged.has(pg.id))
  const auto = b.status === 'Submitted' ? 3 : !b.pages.length ? 0 : untagged.length ? 1 : !b.mapped ? 2 : 3
  const [step, setStep] = useState(auto)
  const doneFlags = [b.pages.length > 0, b.pages.length > 0 && untagged.length === 0 && b.docs.length > 0, b.mapped, b.status === 'Submitted']

  return (
    <div className="detail">
      {e ? <PatientBanner ip={e.ip} compact /> : <div className="pbanner compact unmapped"><div className="pb-avatar"><Icon name="CircleHelp" size={18} /></div><div className="pb-main"><div className="pb-name"><strong>Patient not yet mapped</strong><Badge tone="warn">Loose / external</Badge></div><div className="pb-ids"><span>Capture and tag first, then map the batch to a patient file in step 3.</span></div></div></div>}
      <div className="batch-head">
        <div><small>Intake batch</small><strong className="mono">{b.id}</strong></div>
        <div><small>Source</small><span>{b.source}{b.fileId && <> · <Mono>{b.fileId}</Mono></>}</span></div>
        <div><small>Opened</small><span>{fmtShort(b.createdAt)} · {b.createdBy}</span></div>
        <div><small>Status</small><Badge tone={b.status === 'Submitted' ? 'ok' : 'warn'}>{b.status}</Badge></div>
        {b.status === 'Draft' && <Button size="sm" variant="ghost" icon="Trash2" onClick={() => { if (run('INTAKE_DELETE', { id: b.id }, 'Draft batch discarded').ok) nav('intake', {}) }}>Discard draft</Button>}
      </div>
      <ol className="wizard" role="tablist">
        {STEPS.map(([t, sub], i) => (
          <li key={t}><button role="tab" aria-selected={step === i} className={`${step === i ? 'on' : ''} ${doneFlags[i] ? 'done' : ''}`} onClick={() => setStep(i)}>
            <span className="wz-n">{doneFlags[i] ? <Icon name="Check" size={13} /> : i + 1}</span><span><b>{t}</b><small>{sub}</small></span>
          </button></li>
        ))}
      </ol>
      {step === 0 && <Capture b={b} placeholders={placeholders} onNext={() => setStep(1)} />}
      {step === 1 && <Tagging b={b} placeholders={placeholders} patient={p} enc={e} onNext={() => setStep(b.mapped ? 3 : 2)} />}
      {step === 2 && <Mapping b={b} placeholders={placeholders} onNext={() => setStep(3)} />}
      {step === 3 && <Review b={b} placeholders={placeholders} untagged={untagged} goto={setStep} />}
    </div>
  )
}

function Capture({ b, placeholders, onNext }) {
  const { run } = useStore()
  const expected = placeholders.reduce((a, d) => a + (d.expectedPages || 1), 0)
  const [method, setMethod] = useState(b.source === 'Physical file' ? 'scan' : 'upload')
  const [count, setCount] = useState(expected || 1)
  const [defect, setDefect] = useState('')
  const [defectPage, setDefectPage] = useState(2)
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState([])
  const [err, setErr] = useState('')
  const locked = b.status !== 'Draft'
  const scan = () => { setBusy(true); setTimeout(() => { run('INTAKE_CAPTURE', { id: b.id, method: 'scan', count, defect, defectPage }, `${count} page(s) captured`); setBusy(false) }, 900) }
  const pick = async (list) => {
    setErr('')
    const arr = [...list]
    for (const f of arr) {
      if (!/^(application\/pdf|image\/(jpeg|png|tiff))$/.test(f.type) && !/\.(pdf|jpe?g|png|tiff?)$/i.test(f.name)) return setErr('Only PDF, JPG, PNG and TIFF files are allowed.')
      if (f.size > 25 * 1024 * 1024) return setErr('File exceeds the 25 MB limit.')
      if (f.size === 0) return setErr('The file appears to be empty. Please rescan.')
    }
    setFiles(await Promise.all(arr.map((f) => new Promise((res) => {
      if (/^image\/(jpeg|png)$/.test(f.type) && f.size < 1.5 * 1024 * 1024) { const r = new FileReader(); r.onload = () => res({ name: f.name, size: f.size, src: r.result }); r.readAsDataURL(f) } else res({ name: f.name, size: f.size })
    }))))
  }
  const upload = () => { if (run('INTAKE_CAPTURE', { id: b.id, method: 'upload', uploads: files }, `${files.length} file(s) added to the batch`).ok) setFiles([]) }
  return (
    <Card title="1 · Capture pages" icon="ScanLine" actions={<span className="small muted">{b.pages.length} page(s) in batch</span>}>
      {locked ? <p className="small muted">This batch has been submitted.</p> : <>
        <div className="seg" role="group" aria-label="Capture method">
          <button className={method === 'scan' ? 'on' : ''} onClick={() => setMethod('scan')}><Icon name="ScanLine" size={14} /> Scan paper</button>
          <button className={method === 'upload' ? 'on' : ''} onClick={() => setMethod('upload')}><Icon name="Upload" size={14} /> Upload files</button>
        </div>
        {method === 'scan' ? (
          <>
            <p className="small">Place the whole file in the document feeder and scan it as one batch. You will split it into documents in the next step. <Sim>Simulated scanner</Sim></p>
            {placeholders.length > 0 && <div className="expect"><small>Handover list for this file</small>{placeholders.map((d) => <span key={d.id} className="expect-chip">{docType(d.type).name} <b>{d.expectedPages}p</b></span>)}<span className="muted small">= {expected} pages expected</span></div>}
            <div className="form-grid g3">
              <Field label="Pages in feeder"><input type="number" min="1" max="80" value={count} onChange={(ev) => setCount(Number(ev.target.value))} /></Field>
              <Field label="Resolution / mode"><select defaultValue="300"><option value="300">300 dpi · colour · duplex</option><option>200 dpi · greyscale</option></select></Field>
              <Field label="Scanner"><input readOnly value="MRD Station 1 (simulated)" /></Field>
            </div>
            <details className="demo-ctl"><summary><Icon name="Monitor" size={13} /> Demo control: simulate a scanner problem</summary>
              <div className="form-grid"><Field label="Defect"><select value={defect} onChange={(ev) => setDefect(ev.target.value)}>{DEFECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field><Field label="On page"><input type="number" min="1" value={defectPage} onChange={(ev) => setDefectPage(ev.target.value)} /></Field></div>
            </details>
            {busy && <div className="scanning-bar"><span /></div>}
            <div className="row-end"><Button variant="primary" icon="Scan" disabled={busy} onClick={scan}>{busy ? 'Scanning…' : b.pages.length ? 'Scan more pages' : 'Start scan'}</Button></div>
          </>
        ) : (
          <>
            <p className="small">Upload scanned files or outside documents (referral letters, outside reports, legacy records). Each file becomes a page you can tag.</p>
            <Field label="Files" hint="PDF, JPG, PNG, TIFF · max 25 MB each · empty files are rejected" error={err}>
              <div className="drop">
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" onChange={(ev) => pick(ev.target.files)} aria-label="Choose files to upload" />
                <span><Icon name="Upload" size={18} /> Choose files</span>
              </div>
            </Field>
            <div className="row-end wrap" style={{ justifyContent: 'flex-start' }}>
              <span className="small muted">No file handy?</span>
              <Button size="sm" onClick={() => setFiles([{ name: 'Outside_MRI_Brain_Report_Lilavati_Diagnostics.pdf', size: 612344 }])}>Use sample outside report</Button>
              <Button size="sm" onClick={() => setFiles([{ name: 'Referral_letter_p1.jpg', size: 284001 }, { name: 'Referral_letter_p2.jpg', size: 279812 }])}>Use sample 2-page letter</Button>
            </div>
            {files.length > 0 && <ul className="files">{files.map((f) => <li key={f.name}><Icon name="FileText" size={14} />{f.name}<small>{(f.size / 1024).toFixed(0)} KB</small></li>)}</ul>}
            <div className="row-end"><Button variant="primary" icon="Upload" disabled={!files.length} onClick={upload}>Add to batch</Button></div>
          </>
        )}
      </>}
      {b.pages.length > 0 && <>
        <div className="mini-tray">{b.pages.map((pg, i) => <Thumb key={pg.id} b={b} pg={pg} i={i} />)}</div>
        <div className="row-end"><Button variant="primary" icon="ArrowRight" onClick={onNext}>Continue to tagging</Button></div>
      </>}
    </Card>
  )
}

function Thumb({ b, pg, i, color, selected, onClick, small }) {
  const { s } = useStore()
  const p = b.uhid ? patientOf(s, b.uhid) : null
  const e = b.ip ? encOf(s, b.ip) : null
  const doc = { id: b.id, type: 'OTH', uhid: b.uhid, ip: b.ip, pages: b.pages, source: 'Scan', docDate: b.createdAt }
  return (
    <button type="button" className={`tthumb ${selected ? 'on' : ''} ${pg.discarded ? 'disc' : ''} ${small ? 'sm' : ''}`} onClick={onClick} style={color ? { '--dc': color } : null} aria-pressed={selected} aria-label={`Page ${i + 1}${pg.discarded ? ', discarded' : ''}`}>
      <div className="tthumb-img" style={{ transform: `rotate(${pg.rot}deg)` }}><PageSVG doc={doc} page={{ ...pg, n: i + 1 }} patient={p} enc={e} /></div>
      <span className="tthumb-n">{i + 1}</span>
      {selected && <span className="tthumb-chk"><Icon name="Check" size={12} /></span>}
      {pg.origin === 'Upload' && <span className="tthumb-up" title={pg.upload?.name}><Icon name="Upload" size={10} /></span>}
    </button>
  )
}

function Tagging({ b, placeholders, patient, enc, onNext }) {
  const { s, run } = useStore()
  const [sel, setSel] = useState([])
  const [anchor, setAnchor] = useState(null)
  const [focus, setFocus] = useState(b.pages[0]?.id)
  const firstPh = placeholders.find((d) => !b.docs.some((x) => x.placeholderId === d.id))
  const [form, setForm] = useState({ type: firstPh?.type || 'OTH', folder: docType(firstPh?.type || 'OTH').folder, tags: ['Original'], docDate: toLocalInput(enc?.discharged || s.now), author: enc?.consultant || '', placeholderId: firstPh?.id || '' })
  const docOf = (pid) => b.docs.findIndex((d) => d.pageIds.includes(pid))
  const untagged = b.pages.filter((pg) => !pg.discarded && docOf(pg.id) < 0)
  const locked = b.status !== 'Draft'
  const fp = b.pages.find((x) => x.id === focus) || b.pages[0]
  const fi = b.pages.indexOf(fp)
  const openPh = placeholders.filter((d) => !b.docs.some((x) => x.placeholderId === d.id))
  const phFor = (type) => openPh.filter((d) => d.type === type)

  const click = (pg, ev) => {
    setFocus(pg.id)
    if (locked || pg.discarded) return
    if (ev.shiftKey && anchor) {
      const ids = b.pages.map((x) => x.id)
      const [a, c] = [ids.indexOf(anchor), ids.indexOf(pg.id)].sort((x, y) => x - y)
      setSel([...new Set([...sel, ...ids.slice(a, c + 1).filter((id) => !b.pages.find((x) => x.id === id).discarded)])])
    } else { setSel(sel.includes(pg.id) ? sel.filter((x) => x !== pg.id) : [...sel, pg.id]); setAnchor(pg.id) }
  }
  const pickExpected = (d) => {
    const ids = untagged.slice(0, d.expectedPages || 1).map((x) => x.id)
    setSel(ids); setFocus(ids[0])
    setForm({ ...form, type: d.type, folder: docType(d.type).folder, placeholderId: d.id })
  }
  const setType = (t) => setForm({ ...form, type: t, folder: docType(t).folder, placeholderId: phFor(t)[0]?.id || '' })
  const tag = () => {
    const r = run('INTAKE_TAG', { id: b.id, pageIds: sel, ...form, docDate: fromLocalInput(form.docDate) }, `${sel.length} page(s) tagged as ${docType(form.type).name}`)
    if (r.ok) {
      setSel([])
      const nb = r.state.batches.find((x) => x.id === b.id)
      const next = placeholders.find((d) => !nb.docs.some((x) => x.placeholderId === d.id))
      if (next) setForm((f) => ({ ...f, type: next.type, folder: docType(next.type).folder, placeholderId: next.id }))
    }
  }

  return (
    <Card title="2 · Tag pages into documents" icon="Tag" actions={<span className="small muted">{b.pages.length - untagged.length - b.pages.filter((x) => x.discarded).length}/{b.pages.filter((x) => !x.discarded).length} pages tagged · {b.docs.length} document(s)</span>}>
      {!b.pages.length ? <Empty icon="ScanLine" title="No pages captured yet">Go back to step 1 to scan or upload.</Empty> : <>
        {!locked && openPh.length > 0 && (
          <div className="expect">
            <small>Still expected from the handover list — click to select the next pages for it</small>
            {openPh.map((d) => <button key={d.id} className="expect-chip btnish" onClick={() => pickExpected(d)} disabled={!untagged.length}>{docType(d.type).name} <b>{d.expectedPages}p</b><Icon name="ArrowRight" size={12} /></button>)}
          </div>
        )}
        <div className="tagger">
          <div className="tray-wrap">
            <div className="tray-bar">
              <span className="small"><b>{sel.length}</b> selected</span>
              <span className="sp" />
              {!locked && <>
                <Button size="sm" variant="ghost" onClick={() => setSel(untagged.map((x) => x.id))} disabled={!untagged.length}>Select untagged</Button>
                <Button size="sm" variant="ghost" onClick={() => setSel([])} disabled={!sel.length}>Clear</Button>
                <Button size="sm" icon="ImageOff" onClick={() => { run('INTAKE_PAGE', { id: b.id, pageIds: sel, action: 'discard' }, 'Marked as blank / separator – excluded from the record'); setSel([]) }} disabled={!sel.length} title="Exclude blank sheets or batch separator sheets">Blank / separator</Button>
              </>}
            </div>
            <div className="tray">
              {b.pages.map((pg, i) => { const di = docOf(pg.id); return <Thumb key={pg.id} b={b} pg={pg} i={i} small color={di >= 0 ? COLORS[di % COLORS.length] : null} selected={sel.includes(pg.id)} onClick={(ev) => click(pg, ev)} /> })}
            </div>
            <p className="tiny muted">Tip: click pages to select; Shift-click selects a range. Coloured borders show which document a page belongs to.</p>
          </div>
          <div className="tag-preview">
            {fp && <>
              <div className="paper"><PageSVG doc={{ id: b.id, type: 'OTH', uhid: b.uhid, ip: b.ip, pages: b.pages, source: 'Scan', docDate: b.createdAt }} page={{ ...fp, n: fi + 1 }} patient={patient} enc={enc} /></div>
              <div className="pt-row">
                <span className="small">Page {fi + 1}{fp.discarded && <Badge tone="mute">Excluded</Badge>}{docOf(fp.id) >= 0 && <Badge tone="info">{docType(b.docs[docOf(fp.id)].type).name}</Badge>}</span>
                <span className="sp" />
                {!locked && <>
                  <Button size="sm" icon="RotateCw" onClick={() => run('INTAKE_PAGE', { id: b.id, pageIds: [fp.id], action: 'rotate' })} aria-label="Rotate page" />
                  <Button size="sm" icon="Replace" onClick={() => run('INTAKE_PAGE', { id: b.id, pageIds: [fp.id], action: 'rescan' }, `Page ${fi + 1} rescanned`)}>Rescan</Button>
                  {fp.discarded && <Button size="sm" onClick={() => run('INTAKE_PAGE', { id: b.id, pageIds: [fp.id], action: 'restore' })}>Restore</Button>}
                </>}
              </div>
            </>}
          </div>
          {!locked && (
            <div className="tag-form">
              <h4>Tag selected pages</h4>
              <Field label="Document type" required><select value={form.type} onChange={(ev) => setType(ev.target.value)}>{DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
              <Field label="Classification (folder)" required><select value={form.folder} onChange={(ev) => setForm({ ...form, folder: ev.target.value })}>{FOLDERS.map((f) => <option key={f}>{f}</option>)}</select></Field>
              <Field label="Tags">
                <div className="tagchips">{DOC_TAGS.map((t) => <button key={t} type="button" className={form.tags.includes(t) ? 'on' : ''} aria-pressed={form.tags.includes(t)} onClick={() => setForm({ ...form, tags: form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t] })}>{t}</button>)}</div>
              </Field>
              <Field label="Document (clinical) date" required hint="Stored separately from the scan time"><input type="datetime-local" value={form.docDate} onChange={(ev) => setForm({ ...form, docDate: ev.target.value })} /></Field>
              <Field label="Author / department"><input value={form.author} onChange={(ev) => setForm({ ...form, author: ev.target.value })} placeholder="e.g. Dr. Arvind Menon / Ward 8A" /></Field>
              {b.source === 'Physical file' && (
                <Field label="Fulfils handover item" hint="Links the scan to what the ward listed">
                  <select value={form.placeholderId} onChange={(ev) => setForm({ ...form, placeholderId: ev.target.value })}>
                    <option value="">Additional document (not on the handover list)</option>
                    {phFor(form.type).map((d) => <option key={d.id} value={d.id}>{docType(d.type).name} · {d.expectedPages} p expected</option>)}
                  </select>
                </Field>
              )}
              <Button variant="primary" icon="Tag" disabled={!sel.length} onClick={tag}>Tag {sel.length || ''} page{sel.length === 1 ? '' : 's'} as document</Button>
            </div>
          )}
        </div>
        <DocList b={b} placeholders={placeholders} />
        <div className="row-end">{untagged.length > 0 ? <span className="small t-warn"><Icon name="TriangleAlert" size={14} /> {untagged.length} page(s) still untagged</span> : <span className="small t-ok"><Icon name="CircleCheck" size={14} /> All pages tagged</span>}<Button variant="primary" icon="ArrowRight" onClick={onNext} disabled={!b.docs.length}>{b.mapped ? 'Review & submit' : 'Continue to mapping'}</Button></div>
      </>}
    </Card>
  )
}

function DocList({ b, placeholders }) {
  const { run } = useStore()
  if (!b.docs.length) return null
  const idx = (pid) => b.pages.findIndex((x) => x.id === pid) + 1
  return (
    <div className="doclist">
      {b.docs.map((d, i) => {
        const ph = placeholders.find((x) => x.id === d.placeholderId) || (d.placeholderId ? { expectedPages: null } : null)
        const pages = d.pageIds.map(idx)
        return (
          <div key={d.key} className="docrow" style={{ '--dc': COLORS[i % COLORS.length] }}>
            <span className="docrow-sw" />
            <div className="docrow-main">
              <strong>{docType(d.type).name}</strong>
              <small>{d.folder} · pages {pages.join(', ')} · {fmtShort(d.docDate)}{d.author && ` · ${d.author}`}</small>
              {d.tags.length > 0 && <div className="docrow-tags">{d.tags.map((t) => <span key={t}>{t}</span>)}</div>}
            </div>
            {b.source === 'Physical file' && (d.placeholderId ? <Badge tone={ph?.expectedPages && ph.expectedPages !== pages.length ? 'warn' : 'ok'}>{ph?.expectedPages && ph.expectedPages !== pages.length ? `Handover said ${ph.expectedPages}p` : 'Matches handover'}</Badge> : <Badge tone="info">Additional</Badge>)}
            {b.status === 'Draft' && <Button size="sm" variant="ghost" icon="Trash2" aria-label="Remove tag" onClick={() => run('INTAKE_UNTAG', { id: b.id, key: d.key })} />}
          </div>
        )
      })}
    </div>
  )
}

function Mapping({ b, placeholders, onNext }) {
  const { s, run } = useStore()
  const [q, setQ] = useState('')
  const [ip, setIp] = useState(b.ip || '')
  const [conf, setConf] = useState(b.mapped)
  const res = useMemo(() => searchRecords(s, q).filter((e) => e.discharged && e.record.status !== 'Closed').slice(0, 8), [q, s])
  const e = ip && encOf(s, ip)
  const p = e && patientOf(s, e.uhid)
  const fileBatch = b.source === 'Physical file'
  return (
    <Card title="3 · Map the batch to the patient file" icon="Link2">
      {fileBatch ? (
        <div className="callout"><Icon name="FolderOpen" size={16} /><div>This batch came from physical file <Mono>{b.fileId}</Mono>, received with handover <Mono>{e?.handover?.ref}</Mono>. Confirm the identity on the file cover matches the record before the documents are attached to it.</div></div>
      ) : (
        <>
          <Field label="Find the patient" hint="Name (min. 3 letters), UHID or IP number. Closed records cannot receive new documents.">
            <SearchBox value={q} onChange={setQ} autoFocus={!ip} />
          </Field>
          {q.length >= 3 && !res.length && <p className="small muted">No matching open records. Check the UHID or spelling.</p>}
          {res.length > 0 && <ul className="pick">{res.map((x) => <li key={x.ip}><button className={ip === x.ip ? 'on' : ''} onClick={() => { setIp(x.ip); setConf(false) }}><strong>{patientOf(s, x.uhid).name}</strong><small><Mono>{x.uhid}</Mono> · <Mono>{x.ip}</Mono> · {x.dept}</small><Badge>{x.record.status}</Badge></button></li>)}</ul>}
        </>
      )}
      {e && <>
        <PatientBanner ip={e.ip} compact />
        <div className="map-grid">
          <div><small>UHID</small><Mono>{e.uhid}</Mono></div>
          <div><small>Encounter</small><Mono>{e.ip}</Mono></div>
          <div><small>Physical file</small>{e.fileId ? <Mono>{e.fileId}</Mono> : <span className="muted">none – electronic only</span>}</div>
          <div><small>Folder structure</small><span>{[...new Set(b.docs.map((d) => d.folder))].join(', ') || '—'}</span></div>
        </div>
        <label className={`bigcheck ${conf ? 'on' : 'attn'}`}><input type="checkbox" checked={conf} disabled={b.status !== 'Draft'} onChange={(ev) => setConf(ev.target.checked)} />
          <span><b>I confirm these documents belong to {p.name} ({e.uhid}), admission {e.ip}</b><small>Patient name and UHID on the pages match this record (BR-01, BR-03).</small></span></label>
        {b.status === 'Draft' && <div className="row-end"><Button variant="primary" icon="Link2" onClick={() => { if (run('INTAKE_MAP', { id: b.id, ip, confirmed: conf }, 'Batch mapped to patient file').ok) onNext() }}>{b.mapped ? 'Update mapping' : 'Map to patient file'}</Button></div>}
      </>}
      {fileBatch && <Reconcile b={b} placeholders={placeholders} />}
    </Card>
  )
}

function Reconcile({ b, placeholders }) {
  const { s } = useStore()
  const all = s.documents.filter((d) => d.ip === b.ip && d.kind === 'scanned')
  const rows = [
    ...placeholders.map((d) => { const m = b.docs.find((x) => x.placeholderId === d.id); return { id: d.id, item: docType(d.type).name, expected: d.expectedPages, got: m ? m.pageIds.length : null, state: m ? (m.pageIds.length === d.expectedPages ? 'Matched' : 'Page count differs') : 'Not yet tagged' } }),
    ...b.docs.filter((x) => !x.placeholderId).map((x) => ({ id: x.key, item: docType(x.type).name, expected: null, got: x.pageIds.length, state: 'Additional document' })),
    ...all.filter((d) => d.status !== 'Awaiting Scan').map((d) => ({ id: d.id, item: docType(d.type).name, expected: d.expectedPages, got: d.pages.length, state: `Already digitized (${d.status})` })),
  ]
  return (
    <>
      <h4 className="list-h">Handover reconciliation</h4>
      <Table rows={rows} cols={[
        { label: 'Document', key: 'item' }, { label: 'Expected', render: (r) => (r.expected ? `${r.expected} p` : '—') }, { label: 'Tagged', render: (r) => (r.got != null ? `${r.got} p` : '—') },
        { label: 'Result', render: (r) => <Badge tone={r.state === 'Matched' || r.state.startsWith('Already') ? 'ok' : r.state === 'Not yet tagged' ? 'warn' : r.state === 'Additional document' ? 'info' : 'warn'}>{r.state}</Badge> },
      ]} />
    </>
  )
}

function Review({ b, placeholders, untagged, goto }) {
  const { s, run, nav } = useStore()
  const [dup, setDup] = useState(false)
  const [reason, setReason] = useState('')
  const e = b.ip && encOf(s, b.ip)
  const missingPh = placeholders.filter((d) => !b.docs.some((x) => x.placeholderId === d.id))
  const submit = (dupReason) => {
    const r = run('INTAKE_SUBMIT', { id: b.id, dupReason }, (st) => `${st.batches.find((x) => x.id === b.id).created.length} document(s) sent to QC`)
    if (r.dup) setDup(true)
    if (r.ok) setDup(false)
  }
  if (b.status === 'Submitted') {
    const docs = s.documents.filter((d) => b.created?.includes(d.id))
    return (
      <Card title="Submitted to QC" icon="CircleCheck">
        <div className="success-big"><Icon name="CircleCheck" size={32} /><div><small>Batch {b.id} · {fmtDT(b.submittedAt)}</small><strong>{docs.length} document(s) filed to {patientOf(s, b.uhid)?.name}’s record</strong></div></div>
        <Table rows={docs} cols={[{ label: 'Document', render: (d) => <span><strong>{docType(d.type).name}</strong><small className="block muted"><Mono>{d.id}</Mono></small></span> }, { label: 'Folder', render: (d) => d.folder }, { label: 'Pages', render: (d) => d.pages.length }, { label: 'Tags', render: (d) => <small>{(d.tags || []).join(', ') || '—'}</small> }, { label: 'Status', render: (d) => <Badge>{d.status}</Badge> }]} />
        <div className="row-end wrap">
          <Button icon="Eye" onClick={() => nav('patient', { ip: b.ip, tab: 'docs' })}>Patient 360°</Button>
          {canAccess(s.role, 'qc') && <Button variant="primary" icon="ShieldCheck" onClick={() => nav('qc', { ip: b.ip })}>Open in QC</Button>}
          <Button onClick={() => nav('intake', {})}>Next file</Button>
        </div>
      </Card>
    )
  }
  const issues = []
  if (!b.pages.length) issues.push(['Capture pages first.', 0])
  if (untagged.length) issues.push([`${untagged.length} page(s) not tagged — tag them or mark as blank / separator.`, 1])
  if (!b.docs.length) issues.push(['No documents tagged yet.', 1])
  if (!b.mapped) issues.push(['Batch not yet mapped to a patient file.', 2])
  return (
    <Card title="4 · Review & submit" icon="Send">
      {e && <dl className="dl"><dt>Patient file</dt><dd>{patientOf(s, e.uhid).name} · <Mono>{e.uhid}</Mono> · <Mono>{e.ip}</Mono>{e.fileId && <> · <Mono>{e.fileId}</Mono></>}</dd><dt>Mapped</dt><dd>{b.mapped ? `${fmtDT(b.mappedAt)} by ${b.mappedBy}` : '—'}</dd><dt>Pages</dt><dd>{b.pages.filter((x) => !x.discarded).length} in record · {b.pages.filter((x) => x.discarded).length} excluded as blank / separator</dd></dl>}
      <DocList b={b} placeholders={placeholders} />
      {issues.length > 0 && <div className="callout warn"><Icon name="TriangleAlert" size={16} /><div>{issues.map(([t, st]) => <div key={t}>{t} <button className="linklike" onClick={() => goto(st)}>Fix</button></div>)}</div></div>}
      {!issues.length && missingPh.length > 0 && <div className="callout"><Icon name="Info" size={16} /><div>{missingPh.length} handover item(s) were not found in this batch ({missingPh.map((d) => docType(d.type).name).join(', ')}). They stay in the scanning queue; completeness checks will flag them if they never arrive.</div></div>}
      <div className="row-end"><Button variant="primary" icon="Send" disabled={issues.length > 0} onClick={() => submit()}>Submit {b.docs.length} document(s) to QC</Button></div>
      <Modal open={dup} onClose={() => setDup(false)} title="Possible duplicate" footer={<><Button onClick={() => setDup(false)}>Cancel</Button><Button variant="primary" disabled={!reason.trim()} onClick={() => submit(reason)}>Continue with reason</Button></>}>
        <div className="callout warn"><Icon name="TriangleAlert" size={16} /><div>This file already exists for this patient. Enter a reason to continue.</div></div>
        <Field label="Reason" required><input value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="e.g. Better-quality re-scan of the same report" /></Field>
      </Modal>
    </Card>
  )
}
