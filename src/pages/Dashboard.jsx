import { useStore } from '../store'
import { roleById, docType, currentUser, ROLE_TASKS, PAGES } from '../data/catalog'
import { SCENARIOS } from '../data/scenarios'
import { computeAlerts, stageOf, patientOf, fileStatus, fmtShort, H, levelLabel, fmtDur } from '../lib/logic'
import { Kpi, Card, Table, Badge, Tat, Mono, Empty, Icon, Button, PageHead, Hint } from '../components/ui'

const live = (s) => s.encounters.filter((e) => !e.archive)

export default function Dashboard() {
  const { s, nav } = useStore()
  const role = roleById(s.role)
  const user = currentUser(s)
  const alerts = computeAlerts(s)
  const encs = live(s)
  const by = (k) => encs.filter((e) => stageOf(s, e).key === k)
  const docs = s.documents
  const name = (uhid) => patientOf(s, uhid)?.name
  const reqs = s.requests
  const today = s.now - 12 * H

  const ptCols = (extra = []) => [
    { label: 'Patient', render: (e) => <div className="cell-pt"><strong>{name(e.uhid)}</strong><small><Mono>{e.uhid}</Mono> · <Mono>{e.ip}</Mono></small></div> },
    { label: 'Department', render: (e) => <span>{e.dept}<small className="block muted">{e.ward}</small></span> },
    ...extra,
    { label: 'Status', render: (e) => <Badge>{stageOf(s, e).label}</Badge> },
  ]

  let kpis = [], main = null
  const scenarioIds = { nurse: ['s1'], receiving: ['s2'], scanning: ['s3', 's4'], qc: ['s4'], executive: ['s5', 's6', 's7', 's10'], requester: ['s7', 's8', 's10'], supervisor: ['s8', 's9'] }[s.role]

  if (s.role === 'nurse') {
    const waiting = by('handover')
    const overdue = alerts.filter((a) => a.kind === 'Ward handover overdue')
    kpis = [
      <Kpi key="a" label="Discharged – awaiting handover" value={waiting.length} sub={`${overdue.length} past 24 h TAT`} tone={overdue.length ? 'bad' : 'ink'} icon="ClipboardList" onClick={() => nav('handover')} />,
      <Kpi key="b" label="Sent – awaiting MRD receipt" value={by('receipt').length} sub="In transit to MRD" icon="Truck" onClick={() => nav('handover', { tab: 'sent' })} />,
      <Kpi key="c" label="Currently admitted" value={encs.filter((e) => !e.discharged).length} sub="Will appear after discharge" icon="Hospital" onClick={() => nav('handover', { tab: 'admitted' })} />,
      <Kpi key="d" label="Handed over this week" value={encs.filter((e) => e.handover && e.handover.at > s.now - 168 * H).length} icon="PackageCheck" />,
    ]
    main = <Card title="Discharge records to hand over" icon="ClipboardList" actions={<Button size="sm" onClick={() => nav('handover')}>Open worklist</Button>}>
      <Table rows={waiting} rowKey={(e) => e.ip} onRow={(e) => nav('handover', { ip: e.ip })}
        cols={ptCols([{ label: 'Discharged', render: (e) => fmtShort(e.discharged) }, { label: 'Handover TAT', render: (e) => <Tat due={e.discharged + s.config.tat.handover * H} now={s.now} /> }])}
        empty={<Empty icon="CircleCheck" title="All discharged records handed over">New discharges appear here automatically from the ADT feed.</Empty>} />
    </Card>
  }

  if (s.role === 'receiving') {
    const pend = by('receipt')
    const exc = docs.filter((d) => d.status === 'Exception')
    kpis = [
      <Kpi key="a" label="Physical files awaiting receipt" value={pend.length} sub={`${alerts.filter((a) => a.kind === 'MRD receipt overdue').length} overdue`} icon="Package" onClick={() => nav('receiving')} />,
      <Kpi key="b" label="Electronic docs received (24 h)" value={docs.filter((d) => d.kind === 'electronic' && d.receivedAt > s.now - 24 * H).length} sub="EMR · LIS · RIS · HIS (simulated)" icon="Database" onClick={() => nav('receiving', { tab: 'electronic' })} />,
      <Kpi key="c" label="Intake exceptions" value={exc.length} sub="Unmatched / unclassified" tone={exc.length ? 'warn' : 'ink'} icon="FileWarning" onClick={() => nav('receiving', { tab: 'exceptions' })} />,
      <Kpi key="d" label="Received today" value={encs.filter((e) => e.handover?.receivedAt > today).length} icon="PackageCheck" />,
    ]
    main = <Card title="Handovers waiting at the MRD counter" icon="Inbox">
      <Table rows={pend} rowKey={(e) => e.ip} onRow={(e) => nav('receiving', { ip: e.ip })}
        cols={ptCols([{ label: 'Handover ref', render: (e) => <Mono>{e.handover.ref}</Mono> }, { label: 'Items', render: (e) => `${e.handover.items.length} physical${e.handover.missing.length ? ` · ${e.handover.missing.length} missing` : ''}` }, { label: 'Receipt TAT', render: (e) => <Tat due={e.handover.at + s.config.tat.receipt * H} now={s.now} /> }])}
        empty={<Empty icon="CircleCheck" title="Counter is clear" />} />
    </Card>
  }

  if (s.role === 'scanning') {
    const wait = docs.filter((d) => d.status === 'Awaiting Scan')
    const rework = docs.filter((d) => d.status === 'QC Rejected')
    kpis = [
      <Kpi key="a" label="Received files for intake" value={new Set(wait.map((d) => d.ip)).size} sub={`${wait.length} documents · ${wait.reduce((a, d) => a + (d.expectedPages || 1), 0)} pages expected`} icon="FileScan" onClick={() => nav('intake')} />,
      <Kpi key="b" label="QC rework" value={rework.length} sub="Rejected by QC – rescan" tone={rework.length ? 'bad' : 'ink'} icon="RefreshCw" onClick={() => nav('scanning', { tab: 'rework' })} />,
      <Kpi key="c" label="Scanned (24 h)" value={docs.filter((d) => d.kind === 'scanned' && d.receivedAt > s.now - 24 * H).length} icon="FileScan" />,
      <Kpi key="d" label="Pages in QC" value={docs.filter((d) => d.status === 'QC Pending').reduce((a, d) => a + d.pages.length, 0)} icon="ShieldCheck" />,
    ]
    const files = [...new Set([...rework, ...wait].map((d) => d.ip))].map((ip) => encs.find((e) => e.ip === ip))
    main = <Card title="Files to digitize" icon="ScanLine">
      <Table rows={files} rowKey={(e) => e.ip} onRow={(e) => (rework.some((d) => d.ip === e.ip) ? nav('scanning', { ip: e.ip, tab: 'rework' }) : nav('intake', { ip: e.ip }))}
        cols={ptCols([{ label: 'Documents', render: (e) => { const w = wait.filter((d) => d.ip === e.ip).length, r = rework.filter((d) => d.ip === e.ip).length; return <span>{w ? `${w} to scan` : ''}{w && r ? ' · ' : ''}{r ? <b className="t-bad">{r} rework</b> : ''}</span> } }, { label: 'Scan TAT', render: (e) => <Tat due={e.handover.receivedAt + s.config.tat.scanning * H} now={s.now} /> }])}
        empty={<Empty icon="CircleCheck" title="Nothing waiting to be scanned" />} />
    </Card>
  }

  if (s.role === 'qc') {
    const q = docs.filter((d) => d.status === 'QC Pending')
    kpis = [
      <Kpi key="a" label="Documents awaiting QC" value={q.length} sub={`${q.reduce((a, d) => a + d.pages.length, 0)} pages`} icon="ShieldCheck" onClick={() => nav('qc')} />,
      <Kpi key="b" label="QC overdue" value={alerts.filter((a) => a.kind === 'QC review overdue').length} tone={alerts.some((a) => a.kind === 'QC review overdue') ? 'bad' : 'ink'} icon="Siren" onClick={() => nav('qc')} />,
      <Kpi key="c" label="Rejected – in rework" value={docs.filter((d) => d.status === 'QC Rejected').length} icon="RefreshCw" />,
      <Kpi key="d" label="Approved (24 h)" value={docs.filter((d) => d.qc.some((x) => x.decision === 'Approved' && x.at > s.now - 24 * H)).length} icon="BadgeCheck" />,
    ]
    main = <Card title="QC worklist" icon="ShieldCheck">
      <Table rows={q} onRow={(d) => nav('qc', { doc: d.id })}
        cols={[{ label: 'Patient', render: (d) => <div className="cell-pt"><strong>{name(d.uhid)}</strong><small><Mono>{d.ip}</Mono></small></div> }, { label: 'Document', render: (d) => <span>{docType(d.type).name}{d.version > 1 && <Badge tone="warn">Rework r{d.version}</Badge>}</span> }, { label: 'Pages', key: 'pages', render: (d) => d.pages.length }, { label: 'Scanned', render: (d) => `${fmtShort(d.receivedAt)} · ${d.by}` }, { label: 'QC TAT', render: (d) => <Tat due={d.receivedAt + s.config.tat.qc * H} now={s.now} /> }]}
        empty={<Empty icon="CircleCheck" title="QC queue is empty" />} />
    </Card>
  }

  if (s.role === 'executive') {
    const cod = by('coding')
    kpis = [
      <Kpi key="a" label="Coding & completeness" value={cod.length} sub={`${cod.filter((e) => e.record.status === 'Incomplete').length} with open deficiencies`} icon="FileCheck2" onClick={() => nav('coding')} />,
      <Kpi key="b" label="Awaiting storage" value={by('storage').length} icon="Archive" onClick={() => nav('storage')} />,
      <Kpi key="c" label="Requests to fulfil" value={reqs.filter((r) => ['Pending', 'On Hold'].includes(r.status)).length} sub={`${alerts.filter((a) => a.kind.startsWith('Request')).length} TAT breached`} tone={alerts.some((a) => a.kind.startsWith('Request')) ? 'bad' : 'ink'} icon="Send" onClick={() => nav('desk')} />,
      <Kpi key="d" label="Returns to inspect" value={reqs.filter((r) => r.status === 'Return Submitted').length} icon="Undo2" onClick={() => nav('desk', { tab: 'returns' })} />,
      <Kpi key="e" label="Files out / overdue" value={`${s.files.filter((f) => f.status === 'Issued').length} / ${s.files.filter((f) => fileStatus(s, f) === 'Overdue').length}`} icon="Truck" onClick={() => nav('desk', { tab: 'issued' })} />,
    ]
    const pend = reqs.filter((r) => ['Pending', 'On Hold'].includes(r.status))
    main = <div className="grid2">
      <Card title="Records for coding & completeness" icon="FileCheck2">
        <Table rows={cod} rowKey={(e) => e.ip} onRow={(e) => nav('coding', { ip: e.ip })} cols={ptCols([{ label: 'TAT', render: (e) => <Tat due={e.record.since ? e.record.since + s.config.tat.coding * H : null} now={s.now} /> }])} empty={<Empty icon="CircleCheck" title="Nothing to code" />} />
      </Card>
      <Card title="Open requests" icon="Send">
        <Table rows={pend} onRow={(r) => nav('desk', { req: r.id })} cols={[{ label: 'Ref', render: (r) => <Mono>{r.id}</Mono> }, { label: 'Patient', render: (r) => name(r.uhid) }, { label: 'From', key: 'dept' }, { label: 'Urgency', render: (r) => <Badge>{r.urgency}</Badge> }, { label: 'TAT', render: (r) => <Tat due={r.dueAt} now={s.now} /> }]} empty={<Empty icon="CircleCheck" title="No open requests" />} />
      </Card>
    </div>
  }

  if (s.role === 'requester') {
    const mine = reqs.filter((r) => r.requester === user.name)
    const open = mine.filter((r) => !['Closed', 'Completed', 'Rejected', 'Cancelled'].includes(r.status))
    kpis = [
      <Kpi key="a" label="My open requests" value={open.length} icon="FolderSearch" onClick={() => nav('myrequests')} />,
      <Kpi key="b" label="Files with my department" value={mine.filter((r) => ['Issued', 'Accepted', 'Discrepancy'].includes(r.status)).length} sub="Accept or return" icon="Package" onClick={() => nav('myrequests')} />,
      <Kpi key="c" label="Return overdue" value={mine.filter((r) => r.issue && ['Issued', 'Accepted', 'Discrepancy'].includes(r.status) && s.now > r.issue.expectedReturn).length} tone="warn" icon="Siren" onClick={() => nav('myrequests')} />,
      <Kpi key="d" label="New request" value={<Icon name="Plus" size={26} />} sub="Find a patient & request a file or document" icon="Send" onClick={() => nav('myrequests', { new: 1 })} />,
    ]
    main = <Card title="My requests" icon="FolderSearch">
      <Table rows={open} onRow={(r) => nav('myrequests', { req: r.id })} cols={[{ label: 'Ref', render: (r) => <Mono>{r.id}</Mono> }, { label: 'Patient', render: (r) => <div className="cell-pt"><strong>{name(r.uhid)}</strong><small><Mono>{r.ip}</Mono></small></div> }, { label: 'What', render: (r) => `${r.scope} · ${r.mode}` }, { label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { label: 'Due', render: (r) => r.issue ? <Tat due={r.issue.expectedReturn} now={s.now} /> : <Tat due={r.dueAt} now={s.now} /> }]} empty={<Empty title="No open requests" />} />
    </Card>
  }

  if (s.role === 'supervisor') {
    const openEsc = s.escalations.filter((x) => x.status !== 'Resolved')
    const pipe = [['handover', 'Ward handover', 'handover'], ['receipt', 'MRD receipt', 'receiving'], ['scanning', 'Scanning', 'scanning'], ['qc', 'Quality check', 'qc'], ['coding', 'Coding & completeness', 'coding'], ['storage', 'Storage', 'storage']]
    const maxP = Math.max(1, ...pipe.map(([k]) => by(k).length))
    const staff = {}
    s.audit.filter((a) => a.at > s.now - 24 * H && !['system'].includes(a.role)).forEach((a) => { staff[a.by] = (staff[a.by] || 0) + 1 })
    kpis = [
      <Kpi key="a" label="TAT breaches (live)" value={alerts.length} sub={`${alerts.filter((a) => a.level === 2).length} at Level 2`} tone={alerts.length ? 'bad' : 'ink'} icon="Siren" onClick={() => nav('escalations')} />,
      <Kpi key="b" label="Open escalations" value={openEsc.length} sub={`${openEsc.filter((x) => !x.auto).length} raised by staff`} tone={openEsc.length ? 'warn' : 'ink'} icon="Flag" onClick={() => nav('escalations')} />,
      <Kpi key="c" label="Missing / damaged files" value={s.files.filter((f) => ['Missing', 'Damaged'].includes(f.status)).length} icon="PackageX" onClick={() => nav('storage', { filter: 'exceptions' })} />,
      <Kpi key="d" label="Open deficiencies" value={s.deficiencies.filter((d) => ['Open', 'Responded'].includes(d.status)).length} icon="ListChecks" onClick={() => nav('coding')} />,
      <Kpi key="e" label="Files issued out" value={s.files.filter((f) => f.status === 'Issued').length} sub={`${s.files.filter((f) => fileStatus(s, f) === 'Overdue').length} overdue for return`} icon="Truck" onClick={() => nav('desk', { tab: 'issued' })} />,
    ]
    main = <>
      <Card title="Record pipeline — where every discharged file is right now" icon="Workflow">
        <div className="pipe">
          {pipe.map(([k, l, p]) => {
            const c = by(k).length
            const late = alerts.filter((a) => a.page === p && !a.kind.startsWith('Request') && !a.kind.startsWith('File return')).length
            return (
              <button key={k} className="pipe-col" onClick={() => nav(p)}>
                <div className="pipe-bar"><span style={{ height: `${(c / maxP) * 100}%` }} /></div>
                <strong>{c}</strong><small>{l}</small>{late > 0 && <em>{late} late</em>}
              </button>
            )
          })}
          <div className="pipe-col pipe-done"><div className="pipe-bar"><span style={{ height: '100%' }} /></div><strong>{s.encounters.filter((e) => stageOf(s, e).key === 'stored').length}</strong><small>Closed & stored</small></div>
        </div>
      </Card>
      <div className="grid2">
        <Card title="Most overdue right now" icon="Siren" actions={<Button size="sm" onClick={() => nav('escalations')}>All escalations</Button>}>
          <Table rows={alerts.slice(0, 6)} rowKey={(a) => a.key} onRow={(a) => nav('escalations', { ref: a.ref })}
            cols={[{ label: 'Breach', render: (a) => <span><strong>{a.kind}</strong><small className="block muted">{name(a.uhid)} · <Mono>{a.ref}</Mono></small></span> }, { label: 'Overdue', render: (a) => <b className="t-bad">{fmtDur(a.over)}</b> }, { label: 'Level', render: (a) => <Badge>{levelLabel(a.level)}</Badge> }]}
            empty={<Empty icon="CircleCheck" title="No TAT breaches" />} />
        </Card>
        <Card title="Staff activity (last 24 h)" icon="Users">
          <Table rows={Object.entries(staff).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u, c]) => ({ id: u, u, c }))} cols={[{ label: 'User', key: 'u' }, { label: 'Actions logged', render: (r) => <div className="mini-bar"><span style={{ width: `${Math.min(100, r.c * 12)}%` }} />{r.c}</div> }]} empty={<Empty title="No activity yet" />} />
        </Card>
      </div>
    </>
  }

  const scs = SCENARIOS.filter((x) => scenarioIds.includes(x.id))
  return (
    <div className="page">
      <PageHead kicker={`${role.label} · ${user.title}`} title={`Good ${new Date(s.now + 5.5 * H).getUTCHours() < 12 ? 'morning' : new Date(s.now + 5.5 * H).getUTCHours() < 17 ? 'afternoon' : 'evening'}, ${user.name.split(' ').slice(0, /^(Dr|Sr)\./.test(user.name) ? 2 : 1).join(' ')}`} info={role.blurb} />
      <div className="kpis">{kpis}</div>
      <div className="tasks">
        <span className="tasks-h"><Icon name="Sparkles" size={14} /> Things you can do as {role.short}</span>
        {ROLE_TASKS[s.role].map(([l, pg, prm]) => <button key={l} className="task" onClick={() => nav(pg, prm)}><Icon name={PAGES[pg]?.icon || 'ArrowRight'} size={15} />{l}<Icon name="ArrowRight" size={13} /></button>)}
      </div>
      {main}
      {scs.length > 0 && (
        <Card title="Try it — guided scenarios for this role" icon="CirclePlay" className="card-soft">
          <div className="mini-scen">
            {scs.map((x) => <MiniScenario key={x.id} sc={x} />)}
          </div>
        </Card>
      )}
      <Hint>Tip: switch roles from <b>“Viewing as”</b> at the top. Every action you take here updates the other roles’ worklists, the patient’s 360° view and the audit trail.</Hint>
    </div>
  )
}

export function MiniScenario({ sc }) {
  const { run, nav } = useStore()
  const start = () => {
    run('SET_MODE', { mode: 'guided' })
    run('GUIDE', { guide: { id: sc.id, step: 0 } })
    run('SET_ROLE', { role: sc.steps[0].role })
    nav(sc.steps[0].page, sc.steps[0].params)
  }
  return (
    <button className="ms" onClick={start}>
      <span className="ms-n">{sc.n}</span>
      <span><strong>{sc.title}</strong><small>{sc.patient}</small></span>
      <Icon name="Play" size={14} />
    </button>
  )
}
