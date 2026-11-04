import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { DEF_CATEGORIES, currentUser, docType, defCat } from '../data/catalog'
import { patientOf, encOf, defMatchesUser, defAssigneeLabel, fmtShort, statusOf } from '../lib/logic'
import { PageHead, Tabs, Empty, PatientBanner, Button, Field, Modal, Icon, Hint, Sim, SearchBox, MobileBack } from '../components/ui'
import { DefSummary, DefHistory } from '../components/Lifecycle'
import { RaiseDefModal } from '../components/ReviewKit'
import { DocViewer } from '../components/DocPage'

const MRD_ROLES = ['qc', 'executive', 'supervisor']

export default function Deficiencies() {
  const { s, nav } = useStore()
  const user = currentUser(s)
  const params = s.route.params || {}
  const isMRD = MRD_ROLES.includes(user.role)
  const defaultTab = params.tab || (user.role === 'supervisor' ? 'all' : isMRD ? 'verify' : 'mine')
  const [tab, setTab] = useState(defaultTab)
  useEffect(() => { if (params.tab) setTab(params.tab) }, [params.tab])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [modal, setModal] = useState(null)
  const [raiseFor, setRaiseFor] = useState(null)
  const name = (u) => patientOf(s, u)?.name || ''

  const match = (d) => (!q || [name(d.uhid), d.uhid, d.ip, d.title, d.id, defAssigneeLabel(d)].some((v) => (v || '').toLowerCase().includes(q.toLowerCase()))) && (!cat || d.category === cat) && (!params.ip || d.ip === params.ip)
  const lists = {
    mine: s.deficiencies.filter((d) => defMatchesUser(d, user) && user.role !== 'supervisor' && ['Open', 'Correction Submitted'].includes(d.status)),
    verify: s.deficiencies.filter((d) => d.status === 'Correction Submitted'),
    all: s.deficiencies.filter((d) => ['Open', 'Correction Submitted'].includes(d.status)),
    closed: s.deficiencies.filter((d) => ['Verified', 'Waived'].includes(d.status)),
  }
  const rows = lists[tab].filter(match).sort((a, b) => (a.status === 'Open' ? a.dueAt : a.statusAt) - (b.status === 'Open' ? b.dueAt : b.statusAt))
  const groups = [...new Set(rows.map((d) => d.ip))].map((ip) => ({ ip, defs: rows.filter((d) => d.ip === ip) }))

  // Opening a specific deficiency from a worklist row or the guided demo opens the matching action
  useEffect(() => {
    if (!params.def) return
    const d = s.deficiencies.find((x) => x.id === params.def)
    if (!d) return
    if (d.status === 'Open' && defMatchesUser(d, user)) setModal({ kind: 'resolve', id: d.id })
    else if (d.status === 'Correction Submitted' && isMRD) setModal({ kind: 'verify', id: d.id })
  }, [params.def, user.id])

  const actions = (d) => {
    const out = []
    if (d.status === 'Open' && defMatchesUser(d, user)) out.push(<Button key="r" size="sm" variant="primary" icon="PenLine" onClick={() => setModal({ kind: 'resolve', id: d.id })}>Resolve Issue</Button>)
    if (d.status === 'Correction Submitted' && isMRD) out.push(<Button key="v" size="sm" variant="primary" icon="BadgeCheck" onClick={() => setModal({ kind: 'verify', id: d.id })}>Verify Correction</Button>)
    if (d.status === 'Verified' && isMRD && statusOf(encOf(s, d.ip)) !== 'Accepted & Archived') out.push(<Button key="o" size="sm" icon="RotateCcw" onClick={() => setModal({ kind: 'reopen', id: d.id })}>Reopen</Button>)
    if (['Open', 'Correction Submitted'].includes(d.status) && user.role === 'supervisor') out.push(<Button key="w" size="sm" variant="ghost" icon="Ban" onClick={() => setModal({ kind: 'waive', id: d.id })}>Waive</Button>)
    return out.length ? out : null
  }

  return (
    <div className="page">
      <PageHead kicker="Corrections loop" title="Clinical Deficiencies" info="Each missing document, missing signature or query is a separate task with its own owner, due time and history. Fix it, MRD verifies it — no phone calls or chits.">
        {params.ip && <Button icon="X" onClick={() => nav('deficiencies', { tab })}>Show all patients</Button>}
        {params.ip && isMRD && <Button variant="primary" icon="Flag" onClick={() => setRaiseFor(params.ip)}>Raise deficiency</Button>}
      </PageHead>
      <div className="filters neo-in">
        <SearchBox value={q} onChange={setQ} placeholder="Patient, UHID, IP number, deficiency or assignee" />
        <select value={cat} onChange={(ev) => setCat(ev.target.value)} aria-label="Category"><option value="">All types</option>{DEF_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      </div>
      <Tabs value={tab} onChange={(t) => { setTab(t); nav('deficiencies', { tab: t, ...(params.ip ? { ip: params.ip } : {}) }) }} tabs={[
        ...(user.role !== 'supervisor' && !['qc', 'executive'].includes(user.role) ? [{ id: 'mine', label: 'Assigned to me', icon: 'User', count: lists.mine.length }] : []),
        { id: 'verify', label: 'Awaiting MRD verification', icon: 'BadgeCheck', count: lists.verify.length },
        { id: 'all', label: 'All active', icon: 'FileWarning', count: lists.all.length },
        { id: 'closed', label: 'Closed', icon: 'CircleCheck', count: lists.closed.length },
      ]} />
      {tab === 'mine' && user.role === 'nurse' && <Hint>Showing deficiencies assigned to your wards: {user.wards.join(', ')}.</Hint>}
      {groups.length ? groups.map((g) => (
        <section key={g.ip} className="defgroup">
          <PatientBanner ip={g.ip} compact />
          <div className="deflist">
            {g.defs.map((d) => (
              <div key={d.id}>
                <DefSummary d={d} actions={actions(d)} />
                <details className="defhist"><summary>History of {d.id} ({d.history.length} event{d.history.length > 1 ? 's' : ''})</summary><DefHistory d={d} /></details>
              </div>
            ))}
          </div>
        </section>
      )) : <Empty icon="CircleCheck" title={tab === 'mine' ? 'Nothing assigned to you' : 'Nothing here'}>{tab === 'mine' ? 'When MRD raises a deficiency for you, it appears here with a due time.' : null}</Empty>}
      {modal?.kind === 'resolve' && <ResolveModal id={modal.id} onClose={() => setModal(null)} />}
      {modal?.kind === 'verify' && <VerifyModal id={modal.id} onClose={() => setModal(null)} />}
      {modal && ['reopen', 'waive'].includes(modal.kind) && <ReasonModal kind={modal.kind} id={modal.id} onClose={() => setModal(null)} />}
      {raiseFor && <RaiseDefModal ip={raiseFor} onClose={() => setRaiseFor(null)} />}
    </div>
  )
}

function ResolveModal({ id, onClose }) {
  const { s, run } = useStore()
  const d = s.deficiencies.find((x) => x.id === id)
  const e = encOf(s, d.ip)
  const sign = d.category === 'signature'
  const needsDoc = ['missing', 'incorrect', 'incomplete'].includes(d.category) && d.docType
  const [note, setNote] = useState('')
  const [attach, setAttach] = useState(needsDoc ? 'scan' : '')
  const [signed, setSigned] = useState(false)
  const last = d.corrections.at(-1)
  const submit = () => {
    if (sign && !signed) return run('SUBMIT_CORRECTION', { id, note: '' })
    const r = run('SUBMIT_CORRECTION', { id, note: sign && !note ? `Signed electronically by ${currentUser(s).name}` : note, attach: attach || null }, 'Correction submitted – MRD will verify it')
    if (r.ok) onClose()
  }
  return (
    <Modal open onClose={onClose} title="Resolve deficiency" subtitle={`${d.id} · ${defCat(d.category).label}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="Send" onClick={submit} disabled={sign ? !signed : note.trim().length < 5}>Submit correction</Button></>}>
      <PatientBanner ip={d.ip} compact />
      <div className="callout"><Icon name={defCat(d.category).icon} size={16} /><div><b>{d.title}</b>{d.description && <><br />{d.description}</>}<br /><small>Raised by {d.raisedBy} · {fmtShort(d.raisedAt)}{d.docType && ` · ${docType(d.docType).name}`}</small></div></div>
      {last?.rejected && <div className="callout bad"><Icon name="CircleX" size={16} /><div><b>Your previous correction was rejected</b> by {last.rejected.by}: {last.rejected.reason}</div></div>}
      {sign && (
        <label className={`bigcheck ${signed ? 'on' : 'attn'}`}><input type="checkbox" checked={signed} onChange={(ev) => setSigned(ev.target.checked)} />
          <span><b>Sign {d.docType ? docType(d.docType).name : 'the document'} electronically</b><small><Sim>Simulated e-signature</Sim> In production this uses the hospital’s e-signature / OTP from your own login.</small></span></label>
      )}
      {needsDoc && (
        <Field label="Corrected document">
          <div className="seg">
            <button className={attach === 'scan' ? 'on' : ''} onClick={() => setAttach('scan')}><Icon name="ScanLine" size={14} /> Scan corrected copy</button>
            <button className={attach === 'upload' ? 'on' : ''} onClick={() => setAttach('upload')}><Icon name="Upload" size={14} /> Upload</button>
            <button className={attach === '' ? 'on' : ''} onClick={() => setAttach('')}>No document – explain</button>
          </div>
        </Field>
      )}
      {needsDoc && attach && <p className="small muted"><Sim>Simulated</Sim> A {docType(d.docType).pages || 1}-page corrected copy is attached and sent with your correction; the paper original goes to MRD as usual.</p>}
      <Field label={sign ? 'Note (optional)' : 'What did you correct?'} required={!sign} hint="MRD sees this note when verifying."><textarea rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={d.category === 'clarification' ? 'Your clinical clarification' : 'e.g. Original consent traced in cath lab and added to the file'} /></Field>
      <p className="small muted">Pending since {fmtShort(e.statusAt)} · patient file currently: {statusOf(e)}</p>
    </Modal>
  )
}

function VerifyModal({ id, onClose }) {
  const { s, run } = useStore()
  const d = s.deficiencies.find((x) => x.id === id)
  const e = encOf(s, d.ip)
  const [reject, setReject] = useState(false)
  const [why, setWhy] = useState('')
  const [view, setView] = useState(false)
  const last = d.corrections.at(-1)
  const doc = last?.docId && s.documents.find((x) => x.id === last.docId)
  return (
    <Modal open onClose={onClose} title="Verify correction" subtitle={`${d.id} · ${d.title}`} wide={view}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        {!reject ? <Button variant="danger" icon="CircleX" onClick={() => setReject(true)}>Reject correction</Button>
          : <Button variant="danger" icon="RotateCcw" onClick={() => { if (run('VERIFY_DEF', { id, ok: false, remarks: why }, 'Correction rejected – deficiency reopened and sent back').ok) onClose() }}>Reject & send back</Button>}
        <Button variant="primary" icon="BadgeCheck" onClick={() => { if (run('VERIFY_DEF', { id, ok: true }, 'Correction verified').ok) onClose() }} disabled={reject}>Accept correction</Button>
      </>}>
      <PatientBanner ip={d.ip} compact />
      <div className="callout"><Icon name={defCat(d.category).icon} size={16} /><div><b>Asked:</b> {d.description || d.title}</div></div>
      <div className="corr"><small>Correction by {last.by} · {fmtShort(last.at)}{last.method === 'esign' ? ' · e-signed (simulated)' : ''}</small><span>{last.note}</span></div>
      {doc && <Button size="sm" icon="Eye" onClick={() => setView(!view)}>{view ? 'Hide' : 'View'} corrected document</Button>}
      {view && doc && <DocViewer doc={doc} patient={patientOf(s, e.uhid)} enc={e} />}
      {reject && <Field label="Why is the correction not acceptable?" required hint="Sent back to the responsible person; the deficiency reopens with a new due time."><textarea rows={3} value={why} onChange={(ev) => setWhy(ev.target.value)} autoFocus /></Field>}
      {d.reopened > 0 && <p className="small t-warn">Already reopened {d.reopened} time(s).</p>}
    </Modal>
  )
}

function ReasonModal({ kind, id, onClose }) {
  const { run } = useStore()
  const [why, setWhy] = useState('')
  return (
    <Modal open onClose={onClose} title={kind === 'waive' ? 'Waive deficiency' : 'Reopen deficiency'} subtitle={kind === 'waive' ? 'Only for items that can genuinely never be produced. The reason is kept in the record history.' : 'The responsible person must correct it again.'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={kind === 'waive' ? 'danger' : 'primary'} onClick={() => { if (run(kind === 'waive' ? 'WAIVE_DEF' : 'REOPEN_DEF', { id, reason: why }, kind === 'waive' ? 'Deficiency waived' : 'Deficiency reopened').ok) onClose() }}>{kind === 'waive' ? 'Waive' : 'Reopen'}</Button></>}>
      <Field label="Reason" required><textarea rows={3} value={why} onChange={(ev) => setWhy(ev.target.value)} /></Field>
    </Modal>
  )
}

export { MobileBack }
