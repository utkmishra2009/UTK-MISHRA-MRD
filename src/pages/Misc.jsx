import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { ROLES } from '../data/catalog'
import { SCENARIOS } from '../data/scenarios'
import { patientOf, fmtDT } from '../lib/logic'
import { useDemo } from '../components/Demo'
import { PageHead, Table, Badge, Mono, Card, Button, Field, SearchBox, Modal, Sim } from '../components/ui'

export function Audit() {
  const { s, openTrack } = useStore()
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
      <Table rows={rows} onRow={(a) => a.ip && openTrack(a.ip)}
        cols={[
          { label: 'When', render: (a) => <span className="nowrap">{fmtDT(a.at)}</span> },
          { label: 'User', render: (a) => <span>{a.by}<small className="block muted">{a.role}</small></span> },
          { label: 'Action', render: (a) => <span><strong>{a.action}</strong>{a.to && a.from !== a.to && <small className="block muted">{a.from || 'new'} → {a.to}</small>}</span> },
          { label: 'Patient', render: (a) => (a.uhid ? <span>{patientOf(s, a.uhid)?.name}<small className="block"><Mono>{a.ip}</Mono></small></span> : '—') },
          { label: 'Ref', render: (a) => <Mono>{a.ref}</Mono> },
          { label: 'Remarks', render: (a) => <small>{a.remarks}{a.assigned && <span className="block muted">Next: {a.assigned}</span>}</small> },
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
            <F label="Scan check after scan" path="tat.qc" val={t.qc} />
            <F label="MRD review after receipt" path="tat.review" val={t.review} />
            <F label="Deficiency correction (default)" path="tat.deficiency" val={t.deficiency} />
            <F label="MRD verification of a correction" path="tat.verify" val={t.verify} />
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
              <li>Electronic signatures on corrections (no e-sign / OTP provider connected); notifications</li>
              <li>Approval of handover exceptions (recorded by the nurse; in production captured in the authorizer’s own login)</li>
              <li>ICD-10: a small demo catalogue with keyword suggestions — not a live lookup or automated coding</li>
              <li>QC is a human decision; no AI image-quality detection</li>
              <li>No backend, login or regulatory validation. In production, audit logging, role-based access and status transitions must be enforced by the server, not only by this screen.</li>
            </ul>
          </div>
        </div>
        <h4 className="list-h">Demo assumptions (to confirm with client)</h4>
        <ul className="bul small">
          <li>Physical file tracking is included in this demo although the developer requirements list it as Phase 2 (OQ-11). ICD coding likewise (OQ-12).</li>
          <li>Completeness checklist rules (procedure → consent + operative notes; surgery → anaesthesia consent & record; delivery → partograph; DAMA/Death forms) are illustrative (OQ-02).</li>
          <li>Final acceptance is allowed while paper documents are still waiting to be scanned; the digital copy is tracked separately and shown on every record.</li>
          <li>ICD coding is optional before acceptance and can be completed afterwards.</li>
          <li>TAT defaults are illustrative and editable above.</li>
        </ul>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?" subtitle="All changes made in this browser are discarded and the seeded scenario data is restored."
        footer={<><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={() => { run('RESET', {}, 'Demo data reset'); setConfirm(false) }}>Reset</Button></>} />
    </div>
  )
}

export function Scenarios() {
  const { s, run, nav } = useStore()
  const { start } = useDemo()
  const params = s.route.params || {}
  const [blocked, setBlocked] = useState(null)
  const begin = (sc, auto) => { if (!start(sc, auto)) setBlocked({ sc, auto }) }
  useEffect(() => { if (params.start) { const sc = SCENARIOS.find((x) => x.id === params.start); if (sc) begin(sc, false) } }, [params.start])
  return (
    <div className="page">
      <PageHead kicker="Guided demo" title="See the MRD workflow end to end" info="Each demo uses its own seeded patient and the same screens and actions as the product. Press Play to watch it run automatically, or Step through to do each step yourself. Pause, Resume, Previous, Next, Restart and Exit are in the demo panel.">
        <Button icon="RefreshCw" onClick={() => nav('settings')}>Reset data</Button>
      </PageHead>
      <div className="journey neo-in" aria-hidden>
        {['Discharge', 'Prepare & send', 'MRD receipt', 'Review & scan', 'Deficiency', 'Correction', 'Verification', 'Acceptance', 'Archive & tracking'].map((x, i) => <span key={x}><b>{i + 1}</b>{x}</span>)}
      </div>
      <div className="scen-grid">
        {SCENARIOS.map((sc) => {
          const ready = sc.ready ? sc.ready(s) : true
          return (
            <article key={sc.id} className={`scen ${sc.featured ? 'featured' : ''}`}>
              <header><span className="scen-n">{sc.n}</span><div><h3>{sc.title}</h3><small>Patient: {sc.patient} · {sc.steps.length} steps</small></div>{!ready && <Badge tone="ok">Played</Badge>}</header>
              <dl>
                <dt>Story</dt><dd>{sc.story}</dd>
                <dt>Actors</dt><dd>{sc.actor}</dd>
                <dt>Action</dt><dd>{sc.action}</dd>
                <dt>Result</dt><dd>{sc.expected}</dd>
                <dt>Value</dt><dd className="val">{sc.value}</dd>
              </dl>
              <footer>
                <Button icon="Hand" onClick={() => begin(sc, false)}>Step through</Button>
                <Button variant="primary" icon="Play" onClick={() => begin(sc, true)}>Play automatically</Button>
              </footer>
            </article>
          )
        })}
      </div>
      <Modal open={!!blocked} onClose={() => setBlocked(null)} title="This demo has already been played" subtitle={blocked && `${blocked.sc.patient}’s record has moved on in the current data.`}
        footer={<><Button onClick={() => setBlocked(null)}>Cancel</Button><Button variant="primary" icon="RefreshCw" onClick={() => { const b = blocked; run('RESET', {}, 'Demo data reset'); setBlocked(null); setTimeout(() => start(b.sc, b.auto), 0) }}>Reset demo data & start</Button></>}>
        <p>To avoid duplicate or inconsistent records, a demo only starts from its patient’s original state. Resetting restores all seeded data (your other changes in this browser are discarded).</p>
      </Modal>
    </div>
  )
}
