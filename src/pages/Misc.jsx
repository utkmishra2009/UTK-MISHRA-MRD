import { useState } from 'react'
import { useStore } from '../store'
import { DEPARTMENTS, ROLES } from '../data/catalog'
import { SCENARIOS } from '../data/scenarios'
import { stageOf, patientOf, fmtShort, fmtDT, fileOf, fileStatus, searchRecords } from '../lib/logic'
import { PageHead, Table, Badge, Mono, Empty, Card, Button, Field, Icon, Hint, SearchBox, Modal, Sim } from '../components/ui'

export function Search() {
  const { s, nav } = useStore()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [stage, setStage] = useState('')
  const base = q.trim() ? searchRecords(s, q) : s.encounters.filter((e) => !e.archive)
  const tooShort = q.trim() && q.trim().length < 3 && !/\d/.test(q)
  const rows = tooShort ? [] : base.filter((e) => (!dept || e.dept === dept) && (!stage || stageOf(s, e).key === stage)).sort((a, b) => (b.discharged || b.admitted) - (a.discharged || a.admitted))
  return (
    <div className="page">
      <PageHead kicker="Search & retrieval" title="Patient records" info="Search by patient name, UHID, IP number, file number or handover reference. Open any record to see its full lifecycle." />
      <div className="filters">
        <SearchBox value={q} onChange={setQ} placeholder="Name (min. 3 letters), UHID, IP no., file no., handover ref…" autoFocus />
        <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{DEPARTMENTS.slice(0, 9).map((d) => <option key={d}>{d}</option>)}</select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Lifecycle stage"><option value="">All stages</option>{[['admitted', 'Admitted'], ['handover', 'Awaiting handover'], ['receipt', 'Awaiting receipt'], ['scanning', 'Scanning'], ['qc', 'QC'], ['coding', 'Coding & completeness'], ['storage', 'Awaiting storage'], ['stored', 'Closed & stored']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      {tooShort && <p className="small muted">Name search needs at least 3 characters.</p>}
      {rows.length > 200 ? <Empty title="Too many results. Please refine your search." /> : (
        <Table rows={rows} rowKey={(e) => e.ip} onRow={(e) => nav('patient', { ip: e.ip })}
          cols={[
            { label: 'Patient', render: (e) => { const p = patientOf(s, e.uhid); return <div className="cell-pt"><strong>{p.name}</strong><small>{p.age} y · {p.sex} · <Mono>{e.uhid}</Mono></small></div> } },
            { label: 'Admission', render: (e) => <span><Mono>{e.ip}</Mono><small className="block muted">{e.dept}</small></span> },
            { label: 'Discharged', render: (e) => fmtShort(e.discharged) },
            { label: 'Lifecycle', render: (e) => <Badge>{stageOf(s, e).label}</Badge> },
            { label: 'Physical file', render: (e) => { const f = fileOf(s, e.fileId); return f ? <span><Badge>{fileStatus(s, f)}</Badge></span> : <span className="muted small">—</span> } },
          ]} empty={<Empty icon="Search" title="No matching records">Check the UHID or spelling.</Empty>} />
      )}
      {!q && <Hint>Showing current-year working records. Type to also search the {s.encounters.filter((e) => e.archive).length} archived files in the MRD rooms.</Hint>}
    </div>
  )
}

export function Audit() {
  const { s, nav } = useStore()
  const [q, setQ] = useState('')
  const [who, setWho] = useState('')
  const rows = s.audit.filter((a) => (!who || a.by === who) && (!q || [a.action, a.ref, a.ip, a.uhid, a.remarks, patientOf(s, a.uhid)?.name || ''].some((v) => v.toLowerCase().includes(q.toLowerCase())))).slice().reverse().slice(0, 300)
  const users = [...new Set(s.audit.map((a) => a.by))]
  return (
    <div className="page">
      <PageHead kicker="Compliance" title="Audit trail" info="Append-only log of every significant action: who, what, when, on which record. Entries cannot be edited or deleted." />
      <div className="filters">
        <SearchBox value={q} onChange={setQ} placeholder="Search action, patient, reference…" />
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="User"><option value="">All users & systems</option>{users.map((u) => <option key={u}>{u}</option>)}</select>
      </div>
      <Table rows={rows} onRow={(a) => a.ip && nav('patient', { ip: a.ip, tab: 'timeline' })}
        cols={[
          { label: 'When', render: (a) => <span className="nowrap">{fmtDT(a.at)}</span> },
          { label: 'User', render: (a) => <span>{a.by}<small className="block muted">{a.role}</small></span> },
          { label: 'Action', render: (a) => <strong>{a.action}</strong> },
          { label: 'Patient', render: (a) => (a.uhid ? <span>{patientOf(s, a.uhid)?.name}<small className="block"><Mono>{a.ip}</Mono></small></span> : '—') },
          { label: 'Ref', render: (a) => <Mono>{a.ref}</Mono> },
          { label: 'Remarks', render: (a) => <small>{a.remarks}</small> },
        ]} />
    </div>
  )
}

export function Settings() {
  const { s, run } = useStore()
  const [confirm, setConfirm] = useState(false)
  const t = s.config.tat
  const num = (path, v) => run('CONFIG', { path, value: Math.max(0.25, Number(v) || 0) })
  const F = ({ label, path, val, hint }) => <Field label={label} hint={hint}><div className="unit"><input type="number" step="0.5" min="0.25" defaultValue={val} onBlur={(e) => Number(e.target.value) !== val && num(path, e.target.value)} /><span>hours</span></div></Field>
  return (
    <div className="page">
      <PageHead kicker="Demo configuration" title="TAT rules, clock & demo data" info="Turnaround times drive every due date, overdue flag and escalation in the prototype. Changes apply immediately.">
        <Button variant="danger" icon="RefreshCw" onClick={() => setConfirm(true)}>Reset demo data</Button>
      </PageHead>
      <div className="grid2">
        <Card title="Request fulfilment TAT (by priority & type)" icon="Timer">
          <table className="tbl tbl-plain">
            <thead><tr><th>Priority</th><th>Physical file</th><th>Electronic document</th></tr></thead>
            <tbody>{['Emergency', 'Urgent', 'Routine'].map((u) => <tr key={u}><td><Badge>{u}</Badge></td>{['Physical', 'Electronic'].map((m) => <td key={m}><div className="unit"><input type="number" step="0.5" min="0.25" defaultValue={t.request[u][m]} aria-label={`${u} ${m} TAT`} onBlur={(e) => Number(e.target.value) !== t.request[u][m] && num(`tat.request.${u}.${m}`, e.target.value)} /><span>h</span></div></td>)}</tr>)}</tbody>
          </table>
        </Card>
        <Card title="Record lifecycle TATs" icon="Workflow">
          <div className="form-grid">
            <F label="Ward handover after discharge" path="tat.handover" val={t.handover} />
            <F label="MRD receipt after handover" path="tat.receipt" val={t.receipt} />
            <F label="Scanning after receipt" path="tat.scanning" val={t.scanning} />
            <F label="QC after scan" path="tat.qc" val={t.qc} />
            <F label="Coding & completeness" path="tat.coding" val={t.coding} />
            <F label="Deficiency default due" path="tat.deficiency" val={t.deficiency} />
            <F label="Physical file loan period" path="tat.returnPeriod" val={t.returnPeriod} />
            <F label="Electronic access window" path="tat.accessWindow" val={t.accessWindow} hint="PRD default 48 h" />
          </div>
        </Card>
        <Card title="Escalation thresholds" icon="Siren">
          <p className="small">Level 1 — MRD Supervisor: as soon as an item passes its due time.</p>
          <F label="Level 2 — Medical Superintendent when overdue by" path="escalation.l2AfterHours" val={s.config.escalation.l2AfterHours} />
        </Card>
        <Card title="Simulated demo clock" icon="Clock">
          <p className="small">Current demo time: <b>{fmtDT(s.now)}</b>. Every action also advances the clock by one minute so the audit trail stays ordered.</p>
          <div className="row-end wrap">{[1, 2, 4, 8, 24, 48].map((h) => <Button key={h} size="sm" onClick={() => run('CLOCK', { hours: h }, `Clock advanced ${h} h`)}>+{h} h</Button>)}</div>
        </Card>
      </div>
      <Card title="What is real and what is simulated in this prototype" icon="Monitor">
        <div className="grid2 tight">
          <div>
            <h4 className="list-h">Working in the prototype</h4>
            <ul className="bul">
              <li>All workflows, status transitions, validations and business rules (state is kept in this browser)</li>
              <li>Role-based screens and actions for {ROLES.length} user groups</li>
              <li>TAT calculation, overdue flags and automatic escalations from the demo clock</li>
              <li>Physical storage map, issue/return, location trail</li>
              <li>Append-only audit trail for every action</li>
              <li>Real file selection for uploads (format/size/empty/duplicate checks)</li>
            </ul>
          </div>
          <div>
            <h4 className="list-h">Simulated <Sim /></h4>
            <ul className="bul">
              <li>HIS/ADT, EMR, LIS, RIS interfaces — seeded messages and “simulate” buttons only</li>
              <li>Scanner hardware and page images (generated sample pages)</li>
              <li>Clinician responses to deficiencies; notifications</li>
              <li>ICD-10: a small demo catalogue with keyword suggestions — not a live lookup or automated coding</li>
              <li>QC is a human decision; no AI image-quality detection</li>
              <li>No backend, login, e-signature or regulatory validation</li>
            </ul>
          </div>
        </div>
        <h4 className="list-h">Demo assumptions (to confirm with client)</h4>
        <ul className="bul small">
          <li>Physical file tracking is included in this demo although the developer requirements list it as Phase 2 (OQ-11). ICD coding likewise (OQ-12).</li>
          <li>Completeness checklist rules (procedure → consent + operative notes; surgery → anaesthesia consent & record; delivery → partograph; DAMA/Death forms) are illustrative (OQ-02).</li>
          <li>Scanning and QC are shown as separate roles; the brief PRD merges them under “MRD Operator”.</li>
          <li>TAT defaults are illustrative; PRD defaults kept where stated (48 h access window, 72 h coding).</li>
        </ul>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?" subtitle="All changes made in this browser are discarded and the seeded scenario data is restored."
        footer={<><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={() => { run('RESET', {}, 'Demo data reset'); setConfirm(false) }}>Reset</Button></>} />
    </div>
  )
}

export function Scenarios() {
  const { s, run, nav } = useStore()
  const start = (sc) => {
    run('SET_MODE', { mode: 'guided' })
    run('GUIDE', { guide: { id: sc.id, step: 0 } })
    run('SET_ROLE', { role: sc.steps[0].role })
    nav(sc.steps[0].page, sc.steps[0].params)
  }
  return (
    <div className="page">
      <PageHead kicker="Guided demo" title="Eleven stories, one record lifecycle" info="Each scenario uses its own seeded patient, so they can be played in any order. Press Start — the guide panel tells you which role you are, what to do, and confirms when the step is done.">
        <Button icon="RefreshCw" onClick={() => nav('settings')}>Reset data</Button>
      </PageHead>
      <div className="journey" aria-hidden>
        {['Discharge', 'Handover', 'Receipt', 'Intake & tag', 'QC', 'Code & complete', 'Store', 'Request', 'Issue & accept', 'Return'].map((x, i) => <span key={x}><b>{i + 1}</b>{x}</span>)}
      </div>
      <div className="scen-grid">
        {SCENARIOS.map((sc) => {
          const finished = sc.steps.filter((x) => x.done).every((x) => x.done(s))
          return (
            <article key={sc.id} className="scen">
              <header><span className="scen-n">{sc.n}</span><div><h3>{sc.title}</h3><small>Patient: {sc.patient}</small></div>{finished && <Badge tone="ok">Done</Badge>}</header>
              <dl>
                <dt>Story</dt><dd>{sc.story}</dd>
                <dt>Actor</dt><dd>{sc.actor}</dd>
                <dt>Action</dt><dd>{sc.action}</dd>
                <dt>Expected result</dt><dd>{sc.expected}</dd>
                <dt>Business value</dt><dd className="val">{sc.value}</dd>
              </dl>
              <footer>
                <span className="small muted">{sc.steps.length} steps · {[...new Set(sc.steps.map((x) => ROLES.find((r) => r.id === x.role).short))].join(' → ')}</span>
                <Button variant={finished ? 'default' : 'primary'} icon="Play" onClick={() => start(sc)}>{finished ? 'Replay' : 'Start demo'}</Button>
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
