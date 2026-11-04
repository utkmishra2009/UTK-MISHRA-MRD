import { useState } from 'react'
import { useStore } from '../store'
import { ROLES, ROLE_PAGES, PAGES, roleById, HOSPITAL, USERS, currentUser, userById } from '../data/catalog'
import { computeAlerts, fmtDate, fmtTime, myTasks, tasks } from '../lib/logic'
import { Icon, Button } from './ui'
import { DemoPlayer } from './Demo'
import { LifecycleDrawer } from './Lifecycle'

const PARENT = { scanning: 'intake', qc: 'intake', patient: 'tracking', search: 'tracking' }

export function Shell({ children }) {
  const { s, run, nav, toasts } = useStore()
  const [menu, setMenu] = useState(false)
  const role = roleById(s.role)
  const user = currentUser(s)
  const alerts = computeAlerts(s)
  const openEsc = s.escalations.filter((x) => x.status !== 'Resolved').length
  const pages = ROLE_PAGES[s.role]
  const page = PARENT[s.route?.page] || s.route?.page
  const main = pages.filter((p) => PAGES[p].main)
  const more = pages.filter((p) => !PAGES[p].main)
  const mine = myTasks(s, user)
  const all = tasks(s)
  const count = {
    dashboard: mine.length,
    handover: all.filter((t) => t.bucket === 'notsent' && (!user.wards || user.wards.includes(t.ward))).length,
    receiving: all.filter((t) => ['receipt', 'review', 'ready'].includes(t.bucket)).length,
    deficiencies: user.role === 'qc' || user.role === 'executive' ? all.filter((t) => t.bucket === 'verify').length : mine.filter((t) => t.bucket === 'corrections').length,
    intake: s.documents.filter((d) => ['Awaiting Scan', 'QC Pending', 'QC Rejected'].includes(d.status)).length,
    escalations: openEsc,
  }

  const go = (p) => { nav(p); setMenu(false) }
  const switchUser = (id) => {
    const r = userById(id).role
    run('SET_USER', { userId: id })
    const cur = s.route?.page
    if (!ROLE_PAGES[r].includes(PARENT[cur] || cur) && !['scenarios', 'settings'].includes(cur)) nav('dashboard')
  }
  const NavBtn = ({ p }) => (
    <button className={page === p ? 'on' : ''} onClick={() => go(p)} aria-current={page === p ? 'page' : undefined}>
      <Icon name={PAGES[p].icon} size={17} /><span>{PAGES[p].label}</span>
      {count[p] > 0 && <em className={`nav-count ${p === 'escalations' ? 'bad' : ''}`}>{count[p]}</em>}
    </button>
  )

  return (
    <div className={`app ${s.guide ? 'guiding' : ''}`}>
      <a href="#main" className="skip">Skip to content</a>
      <aside className={`side ${menu ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden><Icon name="FolderOpen" size={18} /></div>
          <div><strong>MRD Suite</strong><small>{HOSPITAL.short} · HMIS module · demo</small></div>
        </div>
        <button className="side-role" style={{ '--rc': role.color }} onClick={() => go('start')} title="Switch user or mode">
          <span className="sr-av">{user.name.replace(/^(Dr|Sr)\. /, '').split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
          <div><strong>{user.name}</strong><small>{role.label}</small></div>
          <Icon name="Users" size={15} />
        </button>
        <nav className="side-nav">
          {main.map((p) => <NavBtn key={p} p={p} />)}
          {more.length > 0 && <div className="side-h">Tools</div>}
          {more.map((p) => <NavBtn key={p} p={p} />)}
          <div className="side-h">Demo</div>
          <button className={page === 'scenarios' ? 'on' : ''} onClick={() => go('scenarios')}><Icon name="CirclePlay" size={17} /><span>Guided Demo</span></button>
          {!pages.includes('settings') && <button className={page === 'settings' ? 'on' : ''} onClick={() => go('settings')}><Icon name="Settings2" size={17} /><span>Demo Settings</span></button>}
        </nav>
        <div className="side-foot">
          <Icon name="Monitor" size={13} /> Prototype. HMIS/EMR/LIS/RIS, scanners and e-signatures are <b>simulated</b>; data is fictitious and kept only in this browser.
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
          <button className={`alert-pill ${alerts.length ? 'has' : ''}`} onClick={() => { if (!ROLE_PAGES[s.role].includes('escalations')) run('SET_ROLE', { role: 'supervisor' }); nav('escalations') }} title="Open TAT breaches & escalations">
            <Icon name="Siren" size={15} /><span>{alerts.length}</span><small>overdue</small>
          </button>
          <Button variant="accent" icon="CirclePlay" onClick={() => nav('scenarios')} className="demo-btn">Guided Demo</Button>
        </header>
        <main id="main" className="content" tabIndex={-1}>{children}</main>
      </div>
      <DemoPlayer />
      <LifecycleDrawer />
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}><Icon name={t.kind === 'err' ? 'CircleAlert' : 'CircleCheck'} size={16} />{t.msg}</div>)}
      </div>
    </div>
  )
}
