import { useState } from 'react'
import { useStore } from '../store'
import { ICD, docType } from '../data/catalog'
import { H, checklist, fmtDT, fmtShort, patientOf, encOf, stageOf, suggestCodes, openMandatoryDefs } from '../lib/logic'
import { MobileBack } from '../components/ui'
import { PageHead, Table, Badge, Tat, Mono, Empty, PatientBanner, Card, Button, Field, Icon, Hint, SearchBox, Modal, Tabs } from '../components/ui'
import { DocViewer } from '../components/DocPage'

export default function Coding() {
  const { s, nav } = useStore()
  const params = s.route.params || {}
  const [tab, setTab] = useState('records')
  const [q, setQ] = useState('')
  const name = (u) => patientOf(s, u)?.name || ''
  const list = s.encounters.filter((e) => !e.archive && stageOf(s, e).key === 'coding' && (!q || [name(e.uhid), e.uhid, e.ip].some((v) => v.toLowerCase().includes(q.toLowerCase()))))
  const sel = params.ip && encOf(s, params.ip)
  const defs = s.deficiencies.slice().sort((a, b) => b.raisedAt - a.raisedAt)
  return (
    <div className="page">
      <PageHead kicker="Record completion" title="Coding & completeness" info="Check every required document is present and authorised, chase what is missing, assign ICD-10 codes, then close the record." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'records', label: 'Records', icon: 'FileCheck2', count: list.length }, { id: 'defs', label: 'All deficiencies', icon: 'ListChecks', count: defs.filter((d) => ['Open', 'Responded'].includes(d.status)).length }]} />
      {tab === 'records' ? (
        <div className={`split ${sel ? 'has-detail' : ''}`}>
          <div className="split-list">
            <SearchBox value={q} onChange={setQ} />
            <Table rows={list} rowKey={(e) => e.ip} onRow={(e) => nav('coding', { ip: e.ip })} rowClass={(e) => (e.ip === params.ip ? 'sel' : '')}
              cols={[
                { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.ip}</Mono> · {e.dept}</small></div> },
                { label: 'Record', render: (e) => <Badge>{e.record.status}</Badge> },
                { label: 'TAT', render: (e) => <Tat due={e.record.since ? e.record.since + s.config.tat.coding * H : null} now={s.now} /> },
              ]} empty={<Empty icon="CircleCheck" title="No records waiting">Records arrive here once every scanned page has passed QC.</Empty>} />
          </div>
          <div className="split-detail"><MobileBack />{sel ? <Workbench key={sel.ip} e={sel} /> : <Empty icon="FileCheck2" title="Select a record" />}</div>
        </div>
      ) : (
        <Table rows={defs} onRow={(d) => nav('coding', { ip: d.ip })} cols={[
          { label: 'Ref', render: (d) => <Mono>{d.id}</Mono> },
          { label: 'Patient', render: (d) => name(d.uhid) },
          { label: 'Missing item', key: 'item' },
          { label: 'Responsible', key: 'responsible' },
          { label: 'Status', render: (d) => <Badge>{d.status}</Badge> },
          { label: 'Due', render: (d) => (['Open'].includes(d.status) ? <Tat due={d.dueAt} now={s.now} /> : fmtShort(d.dueAt)) },
        ]} empty={<Empty icon="CircleCheck" title="No deficiencies raised yet" />} />
      )}
    </div>
  )
}

function Workbench({ e }) {
  const { s, run, toast } = useStore()
  const p = patientOf(s, e.uhid)
  const list = checklist(s, e)
  const [raise, setRaise] = useState(null)
  const [resp, setResp] = useState(e.consultant)
  const [due, setDue] = useState(s.config.tat.deficiency)
  const [rem, setRem] = useState('')
  const [waive, setWaive] = useState(null)
  const [why, setWhy] = useState('')
  const [reopen, setReopen] = useState(null)
  const [view, setView] = useState(null)
  const [qa, setQa] = useState({ id: false, sig: false, dates: false })
  const [q, setQ] = useState('')
  const sugg = suggestCodes(ICD, e.diagnosis).filter((c) => !e.coding.codes.some((x) => x.code === c.code))
  const results = q.length > 1 ? ICD.filter((c) => `${c.code} ${c.desc} ${c.kw}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []
  const openDefs = openMandatoryDefs(s, e)
  const missing = list.filter((c) => c.state === 'missing' || c.state === 'processing')
  const qaOk = qa.id && qa.sig && qa.dates
  const presentCount = list.filter((c) => c.state === 'present' || c.state === 'waived').length

  return (
    <div className="detail">
      <PatientBanner ip={e.ip} />
      <div className="status-strip">
        <div><small>Record status</small><Badge>{e.record.status}</Badge></div>
        <div><small>Checklist</small><strong>{presentCount}/{list.length}</strong></div>
        <div><small>Open deficiencies</small><strong className={openDefs.length ? 't-bad' : ''}>{openDefs.length}</strong></div>
        <div><small>Coding</small><Badge>{e.coding.status === 'Coded' ? 'Coded' : e.coding.status === 'In Progress' ? 'In Progress' : 'Pending'}</Badge></div>
      </div>
      <Card title="Completeness checklist" icon="ListChecks" actions={<span className="small muted">Rules for: {e.procedure === 'none' ? 'medical' : e.procedure} admission · {e.dischargeType} discharge</span>}>
        <ul className="cl">
          {list.map((c) => {
            const d = c.deficiency
            const defOpen = d && ['Open', 'Responded'].includes(d.status)
            return (
              <li key={c.type} className={`cl-${c.state}`}>
                <Icon name={c.state === 'present' ? 'CircleCheck' : c.state === 'waived' ? 'Ban' : c.state === 'processing' ? 'Clock' : 'CircleX'} size={17} />
                <div className="cl-main">
                  <strong>{c.name}</strong>
                  <small>{c.folder}{c.docs[0] && ` · ${c.docs[0].source}${c.docs[0].kind === 'scanned' ? ' (scanned, QC passed)' : ''} · ${fmtShort(c.docs[0].receivedAt)}`}</small>
                  {d && <small className="cl-def"><Mono>{d.id}</Mono> · {d.responsible} · <Badge>{d.status}</Badge>{d.status === 'Open' && <Tat due={d.dueAt} now={s.now} />}</small>}
                </div>
                <div className="cl-act">
                  {c.docs[0] && <Button size="sm" icon="Eye" onClick={() => setView(c.docs[0])}>View</Button>}
                  {c.state === 'missing' && !defOpen && <Button size="sm" variant="primary" icon="Flag" onClick={() => { setRaise(c); setRem(`${c.name} not found in record`) }}>Raise deficiency</Button>}
                  {d?.status === 'Open' && <Button size="sm" icon="Monitor" onClick={() => run('RESPOND_DEF', { id: d.id }, `${d.responsible} supplied the ${d.item} (simulated)`)} title="Simulates the responsible clinician completing / uploading the document">Simulate response</Button>}
                  {d?.status === 'Open' && <Button size="sm" variant="ghost" onClick={() => { setWaive(d); setWhy('') }}>Waive</Button>}
                  {d?.status === 'Responded' && <><Button size="sm" variant="primary" icon="BadgeCheck" onClick={() => run('VERIFY_DEF', { id: d.id, ok: true }, 'Deficiency verified & resolved')}>Verify & resolve</Button><Button size="sm" onClick={() => { setReopen(d); setWhy('') }}>Reopen</Button></>}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="sub-h"><span>MRD quality review</span></div>
        <div className="qa">
          {[['id', 'Patient name & UHID on every page'], ['sig', 'Doctor/nurse signatures present'], ['dates', 'Entries dated and timed']].map(([k, l]) => (
            <label key={k}><input type="checkbox" checked={qa[k]} onChange={(ev) => setQa({ ...qa, [k]: ev.target.checked })} />{l}</label>
          ))}
        </div>
      </Card>

      <Card title="ICD-10 coding" icon="Tag" actions={<Badge tone="mute" dot={false}>Demo code catalogue · {ICD.length} codes</Badge>}>
        <div className="dx"><small>Final diagnosis (from discharge summary – confirmed clinical text)</small><p>{e.diagnosis}</p></div>
        {e.coding.status !== 'Coded' && sugg.length > 0 && (
          <div className="sugg">
            <div className="sugg-h"><Icon name="Sparkles" size={14} /> Demo suggestions <span className="muted">— simple keyword match on the diagnosis text, <b>not</b> automated clinical coding. The coder decides.</span></div>
            {sugg.map((c) => <button key={c.code} className="sugg-chip" onClick={() => run('ADD_CODE', { ip: e.ip, code: c, suggested: true })}><Mono>{c.code}</Mono>{c.desc}<Icon name="Plus" size={13} /></button>)}
          </div>
        )}
        {e.coding.status !== 'Coded' && (
          <div className="icd-search">
            <SearchBox value={q} onChange={setQ} placeholder="Search demo ICD-10 catalogue by code or term…" />
            {results.length > 0 && <ul className="icd-res">{results.map((c) => <li key={c.code}><Mono>{c.code}</Mono><span>{c.desc}</span><Button size="sm" onClick={() => { run('ADD_CODE', { ip: e.ip, code: c }); setQ('') }}>Add</Button></li>)}</ul>}
            {q.length > 1 && !results.length && <p className="small muted">No match in the demo catalogue.</p>}
          </div>
        )}
        <Table rows={e.coding.codes.map((c) => ({ ...c, id: c.code }))} cols={[
          { label: 'Code', render: (c) => <Mono>{c.code}</Mono> },
          { label: 'Description', key: 'desc' },
          { label: 'Type', render: (c) => <span><Badge tone={c.kind === 'Principal' ? 'ok' : 'info'} dot={false}>{c.kind}</Badge>{c.kind !== 'Principal' && e.coding.status !== 'Coded' && <button className="linklike small" onClick={() => run('SET_PRINCIPAL', { ip: e.ip, code: c.code })}>Make principal</button>}</span> },
          { label: 'Basis', render: (c) => <small className="muted">{c.viaSuggestion ? 'Suggestion accepted by coder' : 'Coder selected'}</small> },
          { label: '', render: (c) => e.coding.status !== 'Coded' && <Button size="sm" variant="ghost" icon="Trash2" aria-label="Remove code" onClick={() => run('REMOVE_CODE', { ip: e.ip, code: c.code })} /> },
        ]} empty={<p className="small muted">No codes assigned yet.</p>} />
        {e.coding.status === 'Coded' ? <p className="small">Coded by <b>{e.coding.coder}</b> · {fmtDT(e.coding.at)}</p> :
          <div className="row-end"><Button variant="primary" icon="Check" onClick={() => run('COMPLETE_CODING', { ip: e.ip }, 'Coding completed')} disabled={!e.coding.codes.length}>Complete coding</Button></div>}
      </Card>

      <Card className="card-cta">
        <div className="cta">
          <div>
            {e.record.status === 'Complete' ? <><b>Record is complete.</b> Close it to lock the record and send the physical file for storage.</> :
              openDefs.length ? <><b>{openDefs.length} deficiency(ies) open.</b> The record cannot close until they are resolved or waived (BR-14).</> :
                missing.length ? <><b>{missing.length} required item(s) missing.</b> Raise a deficiency for each.</> :
                  e.coding.status !== 'Coded' ? <><b>Checklist complete.</b> Finish ICD coding to continue.</> :
                    !qaOk ? <><b>Almost there.</b> Tick the three quality-review checks.</> : <><b>Ready.</b> Mark the record complete.</>}
          </div>
          {e.record.status === 'Complete'
            ? <Button variant="primary" icon="Lock" onClick={() => run('CLOSE_RECORD', { ip: e.ip }, 'Record closed & locked – file queued for storage')}>Close record</Button>
            : <Button variant="primary" icon="BadgeCheck" onClick={() => { if (!openDefs.length && !missing.length && e.coding.status === 'Coded' && !qaOk) return toast('Tick the three MRD quality-review checks first', 'err'); run('MARK_COMPLETE', { ip: e.ip }, 'Record marked complete') }}>Mark complete</Button>}
        </div>
      </Card>

      <Modal open={!!raise} onClose={() => setRaise(null)} title="Raise deficiency" subtitle={raise?.name}
        footer={<><Button onClick={() => setRaise(null)}>Cancel</Button><Button variant="primary" onClick={() => { if (run('RAISE_DEF', { ip: e.ip, type: raise.type, responsible: resp, dueH: Number(due), remarks: rem }, 'Deficiency raised – responsible user notified (simulated)').ok) setRaise(null) }}>Raise & notify</Button></>}>
        <Field label="Responsible user" required>
          <select value={resp} onChange={(ev) => setResp(ev.target.value)}><option>{e.consultant}</option><option>{`${e.ward} – Nurse in charge`}</option><option>HOD – {e.dept}</option></select>
        </Field>
        <div className="form-grid"><Field label="Due in (hours)" hint="Default from TAT settings"><input type="number" min="1" value={due} onChange={(ev) => setDue(ev.target.value)} /></Field><Field label="Category"><input readOnly value={raise?.folder || ''} /></Field></div>
        <Field label="Remarks"><textarea rows={2} value={rem} onChange={(ev) => setRem(ev.target.value)} /></Field>
        <p className="small muted">Notifications contain only the reference number — never clinical details (BR-31).</p>
      </Modal>
      <Modal open={!!waive} onClose={() => setWaive(null)} title="Waive deficiency" subtitle="Only the MRD Manager / Supervisor can waive. Switch role if needed."
        footer={<><Button onClick={() => setWaive(null)}>Cancel</Button><Button variant="danger" onClick={() => { if (run('WAIVE_DEF', { id: waive.id, reason: why }, 'Deficiency waived').ok) setWaive(null) }}>Waive</Button></>}>
        <Field label="Reason" required><textarea rows={3} value={why} onChange={(ev) => setWhy(ev.target.value)} placeholder="Why can this item never be produced?" /></Field>
      </Modal>
      <Modal open={!!reopen} onClose={() => setReopen(null)} title="Reopen deficiency"
        footer={<><Button onClick={() => setReopen(null)}>Cancel</Button><Button variant="primary" onClick={() => { if (run('VERIFY_DEF', { id: reopen.id, ok: false, comment: why }, 'Deficiency reopened').ok) setReopen(null) }}>Reopen</Button></>}>
        <Field label="Comment for responsible user" required><textarea rows={3} value={why} onChange={(ev) => setWhy(ev.target.value)} /></Field>
      </Modal>
      <Modal open={!!view} onClose={() => setView(null)} title={view && docType(view.type).name} subtitle={view && `${view.id} · ${view.source}`} wide>
        {view && <DocViewer doc={view} patient={p} enc={e} />}
      </Modal>
    </div>
  )
}
