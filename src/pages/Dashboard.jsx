import { useState } from 'react'
import { useStore } from '../store'
import { roleById, currentUser, ROLE_TASKS, PAGES, WF } from '../data/catalog'
import { SCENARIOS } from '../data/scenarios'
import { computeAlerts, tasks, myTasks, BUCKETS, statusOf, fmtDur, levelLabel, patientOf, H, fileStatus } from '../lib/logic'
import { Kpi, Card, Badge, Icon, PageHead, Tabs, TaskList, Empty, Table, Mono, Button } from '../components/ui'

export default function Dashboard() {
  const { s, nav } = useStore()
  const role = roleById(s.role)
  const user = currentUser(s)
  const all = tasks(s)
  const mine = myTasks(s, user)
  const alerts = computeAlerts(s)
  const [tab, setTab] = useState('mine')
  const late = (b) => all.filter((t) => t.bucket === b && t.due && s.now > t.due).length
  const counts = Object.fromEntries(BUCKETS.map((b) => [b.id, all.filter((t) => t.bucket === b.id).length]))
  const list = tab === 'mine' ? mine : all.filter((t) => t.bucket === tab)
  const sorted = list.slice().sort((a, b) => ((a.due && s.now > a.due) === (b.due && s.now > b.due) ? (a.due || Infinity) - (b.due || Infinity) : a.due && s.now > a.due ? -1 : 1))
  const hour = new Date(s.now + 5.5 * H).getUTCHours()
  const first = user.name.split(' ').slice(0, /^(Dr|Sr)\./.test(user.name) ? 2 : 1).join(' ')
  const live = s.encounters.filter((e) => !e.archive && e.discharged)
  const byStatus = [WF.NOT_SENT, WF.RETURNED, WF.AWAIT_RECEIPT, WF.AWAIT_REVIEW, WF.CORRECTIONS, WF.AWAIT_VERIFY, WF.READY].map((x) => [x, live.filter((e) => statusOf(e) === x).length])
  const maxP = Math.max(1, ...byStatus.map(([, n]) => n))
  const workload = {}
  all.forEach((t) => { workload[t.responsible] = (workload[t.responsible] || 0) + 1 })
  const scs = SCENARIOS.filter((x) => x.roles?.includes(s.role) || x.featured).slice(0, 4)

  return (
    <div className="page">
      <PageHead kicker={`${role.label} · ${user.title}`} title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${first}`} info={role.blurb} />
      <div className="kpis">
        <Kpi label="My pending tasks" value={mine.length} sub={`${mine.filter((t) => t.due && s.now > t.due).length} overdue`} tone={mine.some((t) => t.due && s.now > t.due) ? 'bad' : 'accent'} icon="User" onClick={() => setTab('mine')} />
        {BUCKETS.map((b) => <Kpi key={b.id} label={b.label} value={counts[b.id]} sub={late(b.id) ? `${late(b.id)} overdue` : 'on time'} tone={late(b.id) ? 'warn' : 'ink'} icon={b.icon} onClick={() => setTab(b.id)} />)}
      </div>
      <div className="dash-grid">
        <Card title="Worklist" icon="ListChecks" actions={<span className="small muted">What is pending · who is responsible · next action · how long</span>}>
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'mine', label: 'My Pending Tasks', count: mine.length }, ...BUCKETS.map((b) => ({ id: b.id, label: b.label, count: counts[b.id] }))]} />
          <TaskList items={sorted} empty={<Empty icon="CircleCheck" title={tab === 'mine' ? 'You are all caught up' : 'Nothing in this queue'}>{tab === 'mine' ? 'New work appears here automatically as records move through the workflow.' : null}</Empty>} />
        </Card>
        <div className="dash-side">
          <Card title="Things you can do" icon="Sparkles">
            <div className="tasks col">{ROLE_TASKS[s.role].map(([l, pg, prm]) => <button key={l} className="task" onClick={() => nav(pg, prm)}><Icon name={PAGES[pg]?.icon || 'ArrowRight'} size={15} />{l}<Icon name="ArrowRight" size={13} /></button>)}</div>
          </Card>
          <Card title="Where every discharged record is" icon="Workflow">
            <ul className="bars">{byStatus.map(([l, n]) => <li key={l}><span>{l}</span><div className="bar"><i style={{ width: `${(n / maxP) * 100}%` }} /></div><b>{n}</b></li>)}</ul>
          </Card>
          <Card title="Workload by owner" icon="Users">
            <ul className="bars">{Object.entries(workload).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([l, n]) => <li key={l}><span>{l}</span><div className="bar"><i style={{ width: `${(n / Math.max(...Object.values(workload))) * 100}%` }} /></div><b>{n}</b></li>)}</ul>
          </Card>
          {(s.role === 'supervisor' || alerts.length > 0) && (
            <Card title={`Overdue (${alerts.length})`} icon="Siren" actions={<Button size="sm" variant="ghost" onClick={() => nav('escalations')}>All</Button>} className={alerts.length ? 'card-warn' : ''}>
              <Table rows={alerts.slice(0, 5)} rowKey={(a) => a.key} cols={[
                { label: 'What', render: (a) => <span><strong>{a.kind}</strong><small className="block muted">{patientOf(s, a.uhid)?.name} · <Mono>{a.ref}</Mono></small></span> },
                { label: 'Late by', render: (a) => <span className="stack-r"><b className="t-bad">{fmtDur(a.over)}</b><Badge>{levelLabel(a.level)}</Badge></span> },
              ]} empty={<p className="small muted">No TAT breaches.</p>} />
              {s.files.filter((f) => fileStatus(s, f) === 'Overdue').length > 0 && <p className="small t-warn">{s.files.filter((f) => fileStatus(s, f) === 'Overdue').length} issued file(s) overdue for return.</p>}
            </Card>
          )}
          {scs.length > 0 && <Card title="Guided demo" icon="CirclePlay"><div className="mini-scen">{scs.map((x) => <MiniScenario key={x.id} sc={x} />)}</div></Card>}
        </div>
      </div>
    </div>
  )
}

export function MiniScenario({ sc }) {
  const { nav } = useStore()
  return (
    <button className="ms" onClick={() => nav('scenarios', { start: sc.id })}>
      <span className="ms-n">{sc.n}</span>
      <span><strong>{sc.title}</strong><small>{sc.patient}</small></span>
      <Icon name="Play" size={14} />
    </button>
  )
}
