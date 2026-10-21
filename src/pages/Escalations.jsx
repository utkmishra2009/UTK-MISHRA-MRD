import { useState } from 'react'
import { useStore } from '../store'
import { computeAlerts, fmtDT, fmtDur, fmtShort, levelLabel, patientOf, H } from '../lib/logic'
import { MobileBack } from '../components/ui'
import { PageHead, Table, Badge, Mono, Empty, PatientBanner, Card, Button, Field, Icon, Hint, Tabs, Modal, Kpi } from '../components/ui'

export default function Escalations() {
  const { s, nav } = useStore()
  const params = s.route.params || {}
  const alerts = computeAlerts(s)
  const live = Object.fromEntries(alerts.map((a) => [a.key, a]))
  const [tab, setTab] = useState('Open')
  const name = (u) => patientOf(s, u)?.name || '—'
  const list = s.escalations.filter((x) => (tab === 'Open' ? x.status !== 'Resolved' : x.status === 'Resolved')).sort((a, b) => (live[b.key]?.over || 0) - (live[a.key]?.over || 0) || b.raisedAt - a.raisedAt)
  let sel = params.esc && s.escalations.find((x) => x.id === params.esc)
  if (!sel && params.ref) sel = s.escalations.filter((x) => x.ref === params.ref).sort((a, b) => (a.status === 'Resolved') - (b.status === 'Resolved') || b.raisedAt - a.raisedAt)[0]
  const lvl = (x) => live[x.key]?.level || x.maxLevel || 1
  return (
    <div className="page">
      <PageHead kicker="Supervisor" title="TAT breaches & escalations" info="Breaches are calculated automatically from the demo clock and configured TATs. Staff can also escalate issues manually (QC problems, discrepancies, damaged or missing files).">
        <Button icon="Settings2" onClick={() => nav('settings')}>Configure TATs</Button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Live TAT breaches" value={alerts.length} tone={alerts.length ? 'bad' : 'ink'} icon="Siren" />
        <Kpi label="Level 2 (Med. Superintendent)" value={alerts.filter((a) => a.level === 2).length} sub={`Overdue ≥ ${s.config.escalation.l2AfterHours} h`} tone="warn" icon="TriangleAlert" />
        <Kpi label="Staff-raised issues open" value={s.escalations.filter((x) => !x.auto && x.status !== 'Resolved').length} icon="Flag" />
        <Kpi label="Resolved" value={s.escalations.filter((x) => x.status === 'Resolved').length} icon="CircleCheck" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'Open', label: 'Open & acknowledged', count: s.escalations.filter((x) => x.status !== 'Resolved').length }, { id: 'Resolved', label: 'Resolved', count: s.escalations.filter((x) => x.status === 'Resolved').length }]} />
      <div className={`split ${sel ? 'has-detail' : ''}`}>
        <div className="split-list">
          <Table rows={list} onRow={(x) => nav('escalations', { esc: x.id })} rowClass={(x) => (x.id === sel?.id ? 'sel' : '')}
            cols={[
              { label: 'Issue', render: (x) => <div className="cell-pt"><strong>{x.kind}</strong><small>{name(x.uhid)} · <Mono>{x.ref}</Mono></small></div> },
              { label: 'Source', render: (x) => <small>{x.auto ? 'TAT rule' : x.raisedBy}</small> },
              { label: 'Level', render: (x) => <Badge>{levelLabel(lvl(x))}</Badge> },
              { label: 'Overdue', render: (x) => (live[x.key] ? <b className="t-bad">{fmtDur(live[x.key].over)}</b> : <span className="muted small">{fmtShort(x.raisedAt)}</span>) },
              { label: 'Status', render: (x) => <Badge>{x.status}</Badge> },
            ]} empty={<Empty icon="CircleCheck" title={tab === 'Open' ? 'No open escalations' : 'Nothing resolved yet'}>{tab === 'Open' && 'Advance the demo clock to see TAT breaches appear.'}</Empty>} />
        </div>
        <div className="split-detail"><MobileBack />{sel ? <EscDetail key={sel.id} x={sel} alert={live[sel.key]} level={lvl(sel)} /> : <Empty icon="Siren" title="Select an escalation" />}</div>
      </div>
    </div>
  )
}

function EscDetail({ x, alert, level }) {
  const { s, run, nav } = useStore()
  const [m, setM] = useState(null)
  const [note, setNote] = useState('')
  const [owner, setOwner] = useState('Meera Iyer (MRD Executive)')
  return (
    <div className="detail">
      {x.ip && <PatientBanner ip={x.ip} compact />}
      <Card title={x.kind} icon="Siren" actions={<Badge>{x.status}</Badge>}>
        <dl className="dl">
          <dt>Reference</dt><dd><Mono>{x.ref}</Mono> · <Mono>{x.id}</Mono></dd>
          <dt>Raised</dt><dd>{fmtDT(x.raisedAt)} by {x.raisedBy}</dd>
          <dt>Reason</dt><dd>{x.reason}</dd>
          {x.dueAt && <><dt>Was due</dt><dd>{fmtDT(x.dueAt)}</dd></>}
          {alert && <><dt>Overdue by</dt><dd><b className="t-bad">{fmtDur(alert.over)}</b> (live)</dd></>}
          <dt>Escalation level</dt><dd><Badge>{levelLabel(level)}</Badge></dd>
          <dt>Responsible</dt><dd>{x.responsible}</dd>
          {x.owner && <><dt>Owner</dt><dd>{x.owner}</dd></>}
          {x.resolution && <><dt>Resolution</dt><dd>{x.resolution}</dd></>}
        </dl>
        {x.auto && x.status !== 'Resolved' && <Hint>This escalation closes automatically once the underlying task is done. You can also acknowledge it and assign an owner.</Hint>}
        <div className="row-end wrap">
          {x.page && <Button icon="ArrowRight" onClick={() => { const p = x.page; const params = p === 'desk' ? { req: x.ref } : p === 'qc' ? { doc: x.ref } : p === 'storage' ? { file: x.ref } : { ip: x.ip }; nav(p, params) }}>Go to item</Button>}
          {x.status !== 'Resolved' && <>
            <Button icon="MessageSquare" onClick={() => { setNote(''); setM('note') }}>Add note</Button>
            {x.status === 'Open' && <Button icon="Check" onClick={() => { setNote(''); setM('ack') }}>Acknowledge</Button>}
            <Button variant="primary" icon="CircleCheck" onClick={() => { setNote(''); setM('resolve') }}>Resolve</Button>
          </>}
        </div>
      </Card>
      <Card title="Escalation history" icon="History">
        <ol className="timeline compact">
          <li><div className="tl-dot" /><div className="tl-body"><div className="tl-top"><strong>Raised</strong><time>{fmtDT(x.raisedAt)}</time></div><div className="tl-meta">{x.raisedBy}</div></div></li>
          {x.notes.map((n, i) => <li key={i}><div className="tl-dot" /><div className="tl-body"><div className="tl-top"><strong>{n.text}</strong><time>{fmtDT(n.at)}</time></div><div className="tl-meta">{n.by}</div></div></li>)}
        </ol>
      </Card>
      <Modal open={!!m} onClose={() => setM(null)} title={m === 'ack' ? 'Acknowledge & assign owner' : m === 'resolve' ? 'Resolve escalation' : 'Add note'}
        footer={<><Button onClick={() => setM(null)}>Cancel</Button><Button variant="primary" onClick={() => { if (run('ESC_ACTION', { id: x.id, action: m, note, owner }, m === 'resolve' ? 'Escalation resolved' : m === 'ack' ? 'Acknowledged' : 'Note added').ok) setM(null) }}>Save</Button></>}>
        {m === 'ack' && <Field label="Owner"><select value={owner} onChange={(e) => setOwner(e.target.value)}><option>Meera Iyer (MRD Executive)</option><option>Ramesh Kadam (Receiving)</option><option>Farhan Shaikh (QC)</option><option>Ward nursing in-charge</option><option>Medical Superintendent</option></select></Field>}
        <Field label={m === 'resolve' ? 'Resolution notes' : 'Note'} required={m !== 'ack'}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={m === 'resolve' ? 'e.g. Consent pages located in OT register and re-filed; requester informed.' : ''} /></Field>
      </Modal>
    </div>
  )
}
