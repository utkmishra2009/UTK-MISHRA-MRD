import { useState } from 'react'
import { useStore } from '../store'
import { ROLES, ROLE_PAGES, PAGES, roleById, HOSPITAL, USERS, currentUser, userById } from '../data/catalog'
import { SCENARIOS } from '../data/scenarios'
import { computeAlerts, fmtDate, fmtTime } from '../lib/logic'
import { Icon, Button } from './ui'

export function Shell({ children }) {
  const { s, run, nav, toasts } = useStore()
  const [menu, setMenu] = useState(false)
  const role = roleById(s.role)
  const user = currentUser(s)
  const alerts = computeAlerts(s)
  const openEsc = s.escalations.filter((x) => x.status !== 'Resolved').length
  const pages = ROLE_PAGES[s.role]
  const page = s.route?.page

  const go = (p) => { nav(p); setMenu(false) }
  const switchUser = (id) => {
    const r = userById(id).role
    run('SET_USER', { userId: id })
    const cur = s.route?.page
    if (!ROLE_PAGES[r].includes(cur) && !['patient', 'scenarios', 'settings'].includes(cur)) nav('dashboard')
  }

  return (
    <div className={`app ${s.guide ? 'guiding' : ''}`}>
      <a href="#main" className="skip">Skip to content</a>
      <aside className={`side ${menu ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden><Icon name="FolderOpen" size={18} /></div>
          <div><strong>MRD Suite</strong><small>{HOSPITAL.short} · Demo</small></div>
        </div>
        <div className="side-role" style={{ '--rc': role.color }}>
          <span className="sr-dot" />
          <div><strong>{user.name}</strong><small>{role.short} · {user.title}</small></div>
        </div>
        <nav className="side-nav">
          {pages.map((p) => (
            <button key={p} className={page === p ? 'on' : ''} onClick={() => go(p)} aria-current={page === p ? 'page' : undefined}>
              <Icon name={PAGES[p].icon} size={17} /><span>{PAGES[p].label}</span>
              {p === 'escalations' && openEsc > 0 && <em className="nav-count bad">{openEsc}</em>}
            </button>
          ))}
          <div className="side-sep" />
          <button onClick={() => go('start')}><Icon name="Users" size={17} /><span>Switch user / mode</span></button>
          <button className={page === 'scenarios' ? 'on' : ''} onClick={() => go('scenarios')}><Icon name="CirclePlay" size={17} /><span>Guided Demo</span></button>
          {!pages.includes('settings') && <button className={page === 'settings' ? 'on' : ''} onClick={() => go('settings')}><Icon name="Settings2" size={17} /><span>Demo Settings</span></button>}
        </nav>
        <div className="side-foot">
          <Icon name="Monitor" size={13} /> Prototype · all hospital systems (HIS, EMR, LIS, RIS) are <b>simulated</b> with fictitious data.
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}

      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn hamb" onClick={() => setMenu(true)} aria-label="Open menu"><Icon name="Menu" size={20} /></button>
          <label className="role-switch" style={{ '--rc': role.color }}>
            <span className="rs-label">Viewing as</span>
            <select value={user.id} onChange={(e) => switchUser(e.target.value)} aria-label="Switch user">
              {ROLES.map((r) => <optgroup key={r.id} label={r.label}>{USERS.filter((u) => u.role === r.id).map((u) => <option key={u.id} value={u.id}>{u.name} — {r.short}</option>)}</optgroup>)}
            </select>
            <Icon name="ChevronDown" size={14} />
          </label>
          <button className={`mode-chip ${!s.guide ? 'free' : ''}`} onClick={() => nav('start')} title="Change mode or user">
            <Icon name={s.guide ? 'CirclePlay' : 'Users'} size={14} /><span>{s.guide ? 'Guided demo' : 'Free exploration'}</span>
          </button>
          <div className="clock" title="Simulated demo clock. TATs, overdue flags and escalations are calculated from this time.">
            <Icon name="Clock" size={15} />
            <div className="clock-t"><strong>{fmtTime(s.now)}</strong><small>{fmtDate(s.now)} · demo clock</small></div>
            <button onClick={() => run('CLOCK', { hours: 1 }, 'Demo clock moved forward 1 hour')} aria-label="Advance clock by 1 hour">+1 h</button>
            <button onClick={() => run('CLOCK', { hours: 4 }, 'Demo clock moved forward 4 hours')} aria-label="Advance clock by 4 hours">+4 h</button>
            <button onClick={() => run('CLOCK', { hours: 24 }, 'Demo clock moved forward 1 day')} aria-label="Advance clock by 1 day">+1 d</button>
          </div>
          <button className={`alert-pill ${alerts.length ? 'has' : ''}`} onClick={() => { if (s.role !== 'supervisor') run('SET_ROLE', { role: 'supervisor' }); nav('escalations') }} title="Open TAT breaches & escalations">
            <Icon name="Siren" size={15} /><span>{alerts.length}</span><small>overdue</small>
          </button>
          <Button variant="accent" icon="CirclePlay" onClick={() => nav('scenarios')} className="demo-btn">Guided Demo</Button>
        </header>
        <main id="main" className="content" tabIndex={-1}>{children}</main>
      </div>
      <GuideBar />
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}><Icon name={t.kind === 'err' ? 'CircleAlert' : 'CircleCheck'} size={16} />{t.msg}</div>)}
      </div>
    </div>
  )
}

function GuideBar() {
  const { s, run, nav } = useStore()
  const [min, setMin] = useState(false)
  if (!s.guide) return null
  const sc = SCENARIOS.find((x) => x.id === s.guide.id)
  if (!sc) return null
  const i = s.guide.step
  const step = sc.steps[i]
  const done = step.done ? step.done(s) : null
  const last = i === sc.steps.length - 1
  const go = () => { run('SET_ROLE', { role: step.role }); nav(step.page, step.params) }
  const setStep = (k) => {
    run('GUIDE', { guide: { id: sc.id, step: k } })
    const st = sc.steps[k]
    run('SET_ROLE', { role: st.role }); nav(st.page, st.params)
  }
  const onRight = s.role === step.role && s.route?.page === step.page
  return (
    <div className={`guide ${min ? 'min' : ''} ${done ? 'is-done' : ''}`} role="region" aria-label="Guided demo">
      <div className="guide-head">
        <span className="guide-n">Scenario {sc.n}</span>
        <strong>{sc.title}</strong>
        <span className="guide-prog">{i + 1}/{sc.steps.length}</span>
        <button className="icon-btn" onClick={() => setMin(!min)} aria-label={min ? 'Expand guide' : 'Minimise guide'}><Icon name={min ? 'ChevronLeft' : 'ChevronDown'} size={16} /></button>
        <button className="icon-btn" onClick={() => run('GUIDE', { guide: null })} aria-label="Exit guided demo"><Icon name="X" size={16} /></button>
      </div>
      {!min && (
        <div className="guide-body">
          <div className="guide-dots">{sc.steps.map((_, k) => <i key={k} className={k < i ? 'd' : k === i ? 'c' : ''} />)}</div>
          <div className="guide-role"><Icon name="User" size={12} /> {roleById(step.role).label} · {roleById(step.role).user}</div>
          <p>{step.text}</p>
          {done === true && <div className="guide-ok"><Icon name="CircleCheck" size={15} /> Step complete — the change is now visible to other roles.</div>}
          <div className="guide-actions">
            {!onRight && <Button size="sm" icon="ArrowRight" variant="primary" onClick={go}>Take me there</Button>}
            {i > 0 && <Button size="sm" onClick={() => setStep(i - 1)}>Back</Button>}
            {!last && <Button size="sm" variant={done !== false ? 'primary' : 'default'} onClick={() => setStep(i + 1)}>{done === false ? 'Skip' : 'Next step'}</Button>}
            {last && <Button size="sm" variant={done !== false ? 'primary' : 'default'} onClick={() => { run('GUIDE', { guide: null }); nav('scenarios') }}>Finish</Button>}
          </div>
        </div>
      )}
    </div>
  )
}
