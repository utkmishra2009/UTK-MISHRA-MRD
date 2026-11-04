import { useStore } from '../store'
import { ROLES, USERS, ROLE_TASKS, HOSPITAL } from '../data/catalog'
import { SCENARIOS } from '../data/scenarios'
import { Icon, Button } from '../components/ui'
import { useDemo } from '../components/Demo'

const ROLE_ICON = { nurse: 'Stethoscope', receiving: 'Inbox', scanning: 'FileScan', qc: 'ShieldCheck', executive: 'FileCheck2', requester: 'Send', supervisor: 'Siren' }

export default function Start() {
  const { s, run, nav } = useStore()
  const explore = (u) => {
    run('GUIDE', { guide: null })
    run('SET_MODE', { mode: 'free' })
    run('SET_USER', { userId: u.id })
    nav('dashboard')
  }
  const { start } = useDemo()
  const guided = (sc, auto) => {
    run('SET_MODE', { mode: 'guided' })
    if (sc) { if (!start(sc, auto)) nav('scenarios', { start: sc.id }) } else nav('scenarios')
  }
  return (
    <div className="start">
      <header className="start-hero">
        <div className="start-brand"><div className="brand-mark"><Icon name="FolderOpen" size={20} /></div><div><strong>MRD Suite</strong><small>{HOSPITAL.name} · prototype</small></div></div>
        <h1>Every patient file, from ward to archive — one connected record.</h1>
        <p>Replaces the ward handover register, MRD inward register, deficiency chits and Excel trackers. Nurses send, MRD receives and reviews, clinicians correct, MRD verifies and archives — and anyone can see where a record is and who must act next. HMIS and scanners are simulated with fictitious data.</p>
      </header>
      <div className="start-body">
        <section className="start-col guided-col">
          <div className="start-h"><span className="start-k">Option A</span><h2>Guided demo</h2><p>Watch the workflow play automatically, or step through it yourself. Start with demo 1 — the complete journey with a rejected correction.</p></div>
          <ol className="start-scen">
            {SCENARIOS.map((sc) => (
              <li key={sc.id}><button onClick={() => guided(sc, true)} title="Play automatically"><span className="ms-n">{sc.n}</span><span><strong>{sc.title}</strong><small>{sc.patient} · {[...new Set(sc.steps.map((x) => ROLES.find((r) => r.id === x.role).short))].join(' → ')}</small></span><Icon name="Play" size={14} /></button></li>
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
