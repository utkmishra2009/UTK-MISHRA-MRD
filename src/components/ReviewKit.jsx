import { useState } from 'react'
import { useStore } from '../store'
import { DEF_CATEGORIES, USERS, ICD, docType, checklistTypes } from '../data/catalog'
import { encOf, patientOf, suggestCodes, fmtDT } from '../lib/logic'
import { Modal, Field, Button, Icon, Mono, Badge, Table, SearchBox, Hint } from './ui'
import { DocViewer } from './DocPage'

const TITLES = {
  missing: (n) => `${n} not in file`,
  incomplete: (n) => `${n} incomplete`,
  signature: (n) => `${n} not signed / authorized`,
  incorrect: (n) => `Wrong document filed as ${n}`,
  clarification: () => 'Clinical clarification needed',
}

// Raise a deficiency and assign it to a doctor, a ward's nursing team or a named user
export function RaiseDefModal({ ip, docType: presetType, category: presetCat, onClose, onDone }) {
  const { s, run } = useStore()
  const e = encOf(s, ip)
  const doctors = USERS.filter((u) => u.role === 'requester' && u.dept !== 'Insurance / TPA Desk').map((u) => u.name)
  if (e.consultant && !doctors.includes(e.consultant)) doctors.unshift(e.consultant)
  const [category, setCategory] = useState(presetCat || 'missing')
  const [dt, setDt] = useState(presetType || '')
  const [title, setTitle] = useState(TITLES[presetCat || 'missing'](presetType ? docType(presetType).name : 'Document'))
  const [desc, setDesc] = useState('')
  const [who, setWho] = useState(['missing', 'incomplete'].includes(presetCat) && presetType && docType(presetType).folder === 'Nursing' ? 'ward' : 'doctor')
  const [doc, setDoc] = useState(e.consultant)
  const [due, setDue] = useState(s.config.tat.deficiency)
  const retitle = (c, t) => setTitle(TITLES[c](t ? docType(t).name : 'Document'))
  const save = () => {
    const assignee = who === 'ward' ? { kind: 'ward', ward: e.ward } : { kind: 'user', name: doc }
    const r = run('RAISE_DEF', { ip, category, docType: dt || null, title, description: desc, assignee, dueH: due }, `Deficiency raised and assigned to ${who === 'ward' ? `${e.ward} nursing` : doc}`)
    if (r.ok) { onDone?.(r.state.lastRef); onClose() }
  }
  return (
    <Modal open onClose={onClose} title="Raise a deficiency" subtitle={`${patientOf(s, e.uhid).name} · ${e.ip}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="Flag" onClick={save}>Raise & assign</Button></>}>
      <Field label="What is wrong?">
        <div className="catgrid" role="radiogroup">
          {DEF_CATEGORIES.map((c) => <button key={c.id} role="radio" aria-checked={category === c.id} className={category === c.id ? 'on' : ''} onClick={() => { setCategory(c.id); retitle(c.id, dt) }}><Icon name={c.icon} size={16} />{c.label}</button>)}
        </div>
      </Field>
      <div className="form-grid">
        <Field label="Document"><select value={dt} onChange={(ev) => { setDt(ev.target.value); retitle(category, ev.target.value) }}><option value="">Not document-specific</option>{checklistTypes(e).map((t) => <option key={t} value={t}>{docType(t).name}</option>)}</select></Field>
        <Field label="Short title" required><input value={title} onChange={(ev) => setTitle(ev.target.value)} /></Field>
      </div>
      <Field label="Details for the responsible person" hint="Be specific: page, date, what is needed. Notifications never include clinical details."><textarea rows={3} value={desc} onChange={(ev) => setDesc(ev.target.value)} placeholder="e.g. Consent for PTCA on 17 Oct has the patient’s signature but no witness or doctor signature." /></Field>
      <div className="form-grid">
        <Field label="Assign to" required>
          <div className="seg"><button className={who === 'doctor' ? 'on' : ''} onClick={() => setWho('doctor')}>Doctor</button><button className={who === 'ward' ? 'on' : ''} onClick={() => setWho('ward')}>{e.ward} nursing</button></div>
        </Field>
        {who === 'doctor' ? <Field label="Doctor"><select value={doc} onChange={(ev) => setDoc(ev.target.value)}>{doctors.map((d) => <option key={d}>{d}</option>)}</select></Field> : <Field label="Due in (hours)"><input type="number" min="1" value={due} onChange={(ev) => setDue(ev.target.value)} /></Field>}
        {who === 'doctor' && <Field label="Due in (hours)"><input type="number" min="1" value={due} onChange={(ev) => setDue(ev.target.value)} /></Field>}
      </div>
    </Modal>
  )
}

// Check a scanned document page by page (approve, or send back for rescan)
export function ScanCheck({ doc, onClose }) {
  const { s, run } = useStore()
  const e = encOf(s, doc.ip)
  const [why, setWhy] = useState('')
  const [rej, setRej] = useState(false)
  const defects = doc.pages.filter((p) => p.defect).length
  return (
    <Modal open onClose={onClose} wide title={`Check scan · ${docType(doc.type).name}`} subtitle={`${doc.pages.length} page(s) · scanned ${fmtDT(doc.receivedAt)} by ${doc.by}`}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        {!rej ? <Button variant="danger" icon="RefreshCw" onClick={() => setRej(true)}>Needs rescan</Button>
          : <Button variant="danger" icon="RefreshCw" onClick={() => { if (run('VERIFY_SCAN', { id: doc.id, ok: false, remarks: why }, 'Sent back for rescan').ok) onClose() }}>Send back for rescan</Button>}
        <Button variant="primary" icon="BadgeCheck" onClick={() => { if (run('VERIFY_SCAN', { id: doc.id, ok: true }, 'Scan verified – digital copy available').ok) onClose() }}>All pages clear</Button>
      </>}>
      <DocViewer doc={doc} patient={patientOf(s, e.uhid)} enc={e} />
      {defects > 0 && <Hint>Look closely — this scan has {defects} page(s) that may be unreadable, cut off, blank or from another patient. The prototype simulates these; QC remains a human decision.</Hint>}
      {rej && <Field label="What is wrong with the scan?" required><input value={why} onChange={(ev) => setWhy(ev.target.value)} placeholder="e.g. Page 2 out of focus" autoFocus /></Field>}
    </Modal>
  )
}

// ICD-10 coding (demo catalogue) — part of the review, not a separate screen
export function CodingPanel({ ip }) {
  const { s, run } = useStore()
  const e = encOf(s, ip)
  const [q, setQ] = useState('')
  const locked = e.coding.status === 'Coded' || e.record?.status === 'Closed'
  const sugg = suggestCodes(ICD, e.diagnosis).filter((c) => !e.coding.codes.some((x) => x.code === c.code))
  const results = q.length > 1 ? ICD.filter((c) => `${c.code} ${c.desc} ${c.kw}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []
  return (
    <div className="coding">
      <div className="dx"><small>Final diagnosis (from discharge summary)</small><p>{e.diagnosis}</p></div>
      {!locked && sugg.length > 0 && (
        <div className="sugg">
          <div className="sugg-h"><Icon name="Sparkles" size={14} /> Demo suggestions <span className="muted">— keyword match on the diagnosis text, not automated coding. The coder decides.</span></div>
          {sugg.map((c) => <button key={c.code} className="sugg-chip" onClick={() => run('ADD_CODE', { ip, code: c, suggested: true })}><Mono>{c.code}</Mono>{c.desc}<Icon name="Plus" size={13} /></button>)}
        </div>
      )}
      {!locked && <div className="icd-search">
        <SearchBox value={q} onChange={setQ} placeholder={`Search demo ICD-10 catalogue (${ICD.length} codes)…`} />
        {results.length > 0 && <ul className="icd-res">{results.map((c) => <li key={c.code}><Mono>{c.code}</Mono><span>{c.desc}</span><Button size="sm" onClick={() => { run('ADD_CODE', { ip, code: c }); setQ('') }}>Add</Button></li>)}</ul>}
      </div>}
      <Table rows={e.coding.codes.map((c) => ({ ...c, id: c.code }))} cols={[
        { label: 'Code', render: (c) => <Mono>{c.code}</Mono> },
        { label: 'Description', key: 'desc' },
        { label: 'Type', render: (c) => <span><Badge tone={c.kind === 'Principal' ? 'ok' : 'info'} dot={false}>{c.kind}</Badge>{!locked && c.kind !== 'Principal' && <button className="linklike small" onClick={() => run('SET_PRINCIPAL', { ip, code: c.code })}>Make principal</button>}</span> },
        { label: '', render: (c) => !locked && <Button size="sm" variant="ghost" icon="Trash2" aria-label="Remove code" onClick={() => run('REMOVE_CODE', { ip, code: c.code })} /> },
      ]} empty={<p className="small muted">No codes yet. Coding is optional before acceptance and can be completed later.</p>} />
      {e.coding.status === 'Coded' ? <p className="small">Coded by <b>{e.coding.coder}</b> · {fmtDT(e.coding.at)}</p>
        : !locked && <div className="row-end"><Button icon="Check" disabled={!e.coding.codes.length} onClick={() => run('COMPLETE_CODING', { ip }, 'Coding completed')}>Complete coding</Button></div>}
    </div>
  )
}

export function ReturnModal({ ip, onClose, onDone }) {
  const { run } = useStore()
  const [cat, setCat] = useState('Incomplete file')
  const [reason, setReason] = useState('')
  return (
    <Modal open onClose={onClose} title="Return file to ward" subtitle="The ward sees the reason in Records Not Sent and must fix and resend."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" icon="Undo2" onClick={() => { if (run('RETURN_HANDOVER', { ip, category: cat, reason }, 'File returned to ward').ok) { onDone?.(); onClose() } }}>Return to ward</Button></>}>
      <Field label="Why?"><select value={cat} onChange={(ev) => setCat(ev.target.value)}>{['Incomplete file', 'Wrong patient / mismatched file', 'Documents unsigned', 'Damaged file', 'Other'].map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Details" required><textarea rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="e.g. Nursing notes and medication chart not in the file" /></Field>
    </Modal>
  )
}

export function EscalateModal({ ip, refId, page, onClose }) {
  const { run } = useStore()
  const [reason, setReason] = useState('')
  return (
    <Modal open onClose={onClose} title="Escalate to MRD supervisor" subtitle="For problems you cannot resolve: disputes with the ward, missing originals, medico-legal concerns."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="Siren" onClick={() => { if (run('ESCALATE', { kind: 'Record escalated by MRD', ref: refId || ip, ip, page, reason }, 'Escalated to MRD supervisor').ok) onClose() }}>Escalate</Button></>}>
      <Field label="Reason" required><textarea rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} /></Field>
    </Modal>
  )
}
