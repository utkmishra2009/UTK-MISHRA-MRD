import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import { roleById, defaultUser } from '../data/catalog'
import { scenarioById, stepParams } from '../data/scenarios'
import { Icon, Button } from './ui'

// Whole-state snapshots taken on entering each step: Previous / Restart rewind to them, so a demo can be
// replayed any number of times without duplicate handovers, deficiencies or audit entries.
const snaps = []
const LEAD = 1700 // ms on a step's screen before the automatic action runs
const DWELL = 3200 // ms to look at the result before moving on

export function useDemo() {
  const { run, snapshot, restore } = useStore()
  const goStep = useCallback((sc, i) => {
    const step = sc.steps[i]
    run('SET_ROLE', { role: step.role })
    run('NAV', { page: step.page, params: stepParams(step, snapshot()) })
  }, [run, snapshot])
  const start = useCallback((sc, auto) => {
    const cur = snapshot()
    if (sc.ready && !sc.ready(cur)) return false
    snaps.length = 0
    snaps[0] = cur
    run('SET_MODE', { mode: 'guided' })
    run('GUIDE', { guide: { id: sc.id, step: 0, playing: !!auto } })
    goStep(sc, 0)
    return true
  }, [run, snapshot, goStep])
  const hasSnap = (i) => !!snaps[i]
  const rewind = useCallback((sc, i, playing) => {
    if (!snaps[i]) return false
    restore(snaps[i], { guide: { id: sc.id, step: i, playing } })
    snaps.length = i + 1
    goStep(sc, i)
    return true
  }, [restore, goStep])
  const undoAll = useCallback(() => { if (snaps[0]) restore(snaps[0], { guide: null }); snaps.length = 0 }, [restore])
  return { start, goStep, rewind, undoAll, hasSnap, snaps }
}

export function DemoPlayer() {
  const { s, run, snapshot, nav, toast } = useStore()
  const { goStep, rewind, undoAll, hasSnap, snaps: snapList } = useDemo()
  const [min, setMin] = useState(false)
  const [exitMenu, setExitMenu] = useState(false)
  const g = s.guide
  const sc = g && scenarioById(g.id)

  const advance = useCallback((fromAuto) => {
    const cur = snapshot().guide
    if (!cur) return
    const scn = scenarioById(cur.id)
    const step = scn.steps[cur.step]
    const st = snapshot()
    if (fromAuto && step.done && !step.done(st)) { run('GUIDE', { guide: { ...cur, playing: false } }); toast('Demo paused: this step did not complete. Use Restart, or reset demo data in Settings.', 'err'); return }
    if (!fromAuto && step.auto && step.done && !step.done(st)) {
      const r = step.auto(run, snapshot)
      if (r && r.ok === false) return
    }
    if (cur.step >= scn.steps.length - 1) { run('GUIDE', { guide: { ...cur, playing: false, finished: true } }); return }
    snapList[cur.step + 1] = snapshot()
    run('GUIDE', { guide: { ...cur, step: cur.step + 1, finished: false } })
    goStep(scn, cur.step + 1)
  }, [run, snapshot, goStep, snapList, toast])

  // Automatic playback: show the screen → run the step's action → pause to show the result → next
  useEffect(() => {
    if (!g?.playing || !sc) return undefined
    const step = sc.steps[g.step]
    goStep(sc, g.step)
    let t2
    const t1 = setTimeout(() => {
      try {
        if (step.auto && !(step.done && step.done(snapshot()))) step.auto(run, snapshot)
      } catch (err) { toast(`Demo step could not run: ${err.message}`, 'err') }
      t2 = setTimeout(() => advance(true), DWELL)
    }, LEAD)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [g?.playing, g?.step, g?.id])

  if (!g || !sc) return null
  const i = g.step
  const step = sc.steps[i]
  const done = step.done ? step.done(s) : true
  const last = i === sc.steps.length - 1
  const role = roleById(step.role)
  const onRight = s.role === step.role && s.route?.page === step.page
  const setPlaying = (playing) => run('GUIDE', { guide: { ...g, playing } })
  const restart = () => { if (!rewind(sc, 0, g.playing)) toast('Restart is unavailable after a page reload — reset demo data from Demo Settings', 'err') }
  const prev = () => { if (i > 0 && !rewind(sc, i - 1, false)) toast('Previous is unavailable after a page reload', 'err') }

  return (
    <div className={`guide ${min ? 'min' : ''} ${done ? 'is-done' : ''} ${g.playing ? 'is-playing' : ''}`} role="region" aria-label="Guided demo">
      <div className="guide-head">
        <span className="guide-n">Demo {sc.n}</span>
        <strong>{sc.title}</strong>
        <span className="guide-prog">{i + 1}/{sc.steps.length}</span>
        <button className="icon-btn" onClick={() => setMin(!min)} aria-label={min ? 'Expand demo panel' : 'Minimise demo panel'}><Icon name={min ? 'ChevronLeft' : 'ChevronDown'} size={16} /></button>
        <button className="icon-btn" onClick={() => setExitMenu(!exitMenu)} aria-label="Exit demo"><Icon name="X" size={16} /></button>
      </div>
      {exitMenu && (
        <div className="guide-exit">
          <span>Leave the demo?</span>
          <Button size="sm" onClick={() => { setExitMenu(false); run('GUIDE', { guide: null }) }}>Exit, keep changes</Button>
          {hasSnap(0) && <Button size="sm" onClick={() => { setExitMenu(false); undoAll(); nav('scenarios') }}>Exit & undo demo</Button>}
          <Button size="sm" variant="ghost" onClick={() => setExitMenu(false)}>Stay</Button>
        </div>
      )}
      {!min && (
        <div className="guide-body">
          <div className="guide-dots">{sc.steps.map((_, k) => <i key={k} className={k < i ? 'd' : k === i ? 'c' : ''} />)}</div>
          <div className="guide-step"><b>{step.title}</b></div>
          <div className="guide-role"><Icon name="User" size={12} /> {role.label} · {defaultUser(step.role).name}</div>
          <p>{step.text}</p>
          {g.playing && <div className="guide-run"><span /></div>}
          {!g.playing && done && step.done && <div className="guide-ok"><Icon name="CircleCheck" size={15} /> Done — the change is already visible to the other roles.</div>}
          {!g.playing && !done && <div className="guide-wait"><Icon name="Hand" size={14} /> Your turn: do it on screen, or press <b>Do it for me</b>.</div>}
          {g.finished && <div className="guide-ok"><Icon name="CircleCheck" size={15} /> Demo complete.</div>}
          <div className="guide-actions">
            <button className="gbtn" onClick={restart} title="Restart from the beginning" aria-label="Restart"><Icon name="RotateCcw" size={15} /></button>
            <button className="gbtn" onClick={prev} disabled={i === 0} title="Previous step" aria-label="Previous step"><Icon name="SkipBack" size={15} /></button>
            {g.playing
              ? <button className="gbtn main" onClick={() => setPlaying(false)} aria-label="Pause"><Icon name="Pause" size={16} /> Pause</button>
              : <button className="gbtn main" onClick={() => setPlaying(true)} disabled={g.finished} aria-label={i === 0 && !snapList[1] ? 'Start' : 'Resume'}><Icon name="Play" size={16} /> {i === 0 && !snapList[1] ? 'Play' : 'Resume'}</button>}
            <button className="gbtn" onClick={() => advance(false)} disabled={g.playing || (last && g.finished)} title={done ? 'Next step' : 'Perform this step automatically, then continue'}>{done ? (last ? 'Finish' : 'Next') : 'Do it for me'} <Icon name="SkipForward" size={15} /></button>
          </div>
          {!onRight && !g.playing && <button className="linklike small" onClick={() => goStep(sc, i)}>Take me back to this step’s screen</button>}
        </div>
      )}
    </div>
  )
}
