import { useStore } from '../store'
import { ROLES, USERS, ROLE_TASKS, HOSPITAL } from '../data/catalog'
import { SCENARIOS } from '../data/scenarios'
import { Icon, Button } from '../components/ui'

const ROLE_ICON = { nurse: 'Stethoscope', receiving: 'Inbox', scanning: 'FileScan', qc: 'ShieldCheck', executive: 'FileCheck2', requester: 'Send', supervisor: 'Siren' }

export default function Start() {
  const { s, run, nav } = useStore()
  const explore = (u) => {
    run('GUIDE', { guide: null })
    run('SET_MODE', { mode: 'free' })
    run('SET_USER', { userId: u.id })
    nav('dashboard')
  }
  const guided = (sc) => {
    run('SET_MODE', { mode: 'guided' })
    if (sc) {
      run('GUIDE', { guide: { id: sc.id, step: 0 } })
      run('SET_ROLE', { role: sc.steps[0].role })
      nav(sc.steps[0].page, sc.steps[0].params)
    } else nav('scenarios')
  }
  return (
    <div className="start">
      <header className="start-hero">
        <div className="start-brand"><div className="brand-mark"><Icon name="FolderOpen" size={20} /></div><div><strong>MRD Suite</strong><small>{HOSPITAL.name} · prototype</small></div></div>
        <h1>Medical records, from discharge to shelf — and back.</h1>
        <p>Follow one patient file through ward handover, MRD receipt, document intake, quality check, coding, storage and retrieval. Every hospital system is simulated with fictitious data.</p>
      </header>
      <div className="start-body">
        <section className="start-col guided-col">
          <div className="start-h"><span className="start-k">Option A</span><h2>Guided demo</h2><p>Short stories with a step-by-step guide. The app switches roles for you and confirms each step.</p></div>
          <ol className="start-scen">
            {SCENARIOS.map((sc) => (
              <li key={sc.id}><button onClick={() => guided(sc)}><span className="ms-n">{sc.n}</span><span><strong>{sc.title}</strong><small>{sc.patient} · {[...new Set(sc.steps.map((x) => ROLES.find((r) => r.id === x.role).short))].join(' → ')}</small></span><Icon name="Play" size={14} /></button></li>
            ))}
          </ol>
          <Button variant="accent" icon="CirclePlay" onClick={() => guided()}>See all scenarios with details</Button>
        </section>
        <section className="start-col">
          <div className="start-h"><span className="start-k">Option B</span><h2>Explore freely as a user</h2><p>Pick a person from any user group and work through their screens on your own — hand over a file, scan and tag documents, approve QC, issue files, resolve escalations. Switch user at any time from the top bar.</p></div>
          <div className="groups">
            {ROLES.map((r) => (
              <article key={r.id} className="group" style={{ '--rc': r.color }}>
                <header><span className="group-ic"><Icon name={ROLE_ICON[r.id]} size={18} /></span><div><h3>{r.label}</h3><small>{r.blurb}</small></div></header>
                <ul className="group-tasks">{ROLE_TASKS[r.id].slice(0, 3).map(([l]) => <li key={l}>{l}</li>)}</ul>
                <div className="group-users">
                  {USERS.filter((u) => u.role === r.id).map((u) => (
                    <button key={u.id} className={s.mode === 'free' && s.userId === u.id ? 'on' : ''} onClick={() => explore(u)}>
                      <span className="gu-av">{u.name.replace(/^(Dr|Sr)\. /, '').split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
                      <span><strong>{u.name}</strong><small>{u.title}</small></span>
                      <Icon name="ArrowRight" size={14} />
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <footer className="start-foot">
        <span><Icon name="Monitor" size={13} /> Prototype · state is kept in this browser · HIS, EMR, LIS, RIS, scanner and ICD lookup are simulated.</span>
        {s.mode && <Button size="sm" onClick={() => nav('dashboard')}>Back to the app</Button>}
        <Button size="sm" variant="ghost" icon="RefreshCw" onClick={() => run('RESET', {}, 'Demo data reset')}>Reset demo data</Button>
      </footer>
    </div>
  )
}
