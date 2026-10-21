import { useState } from 'react'
import { useStore } from '../store'
import { STORAGE, locLabel, locKey } from '../data/catalog'
import { fileStatus, fmtDT, patientOf, encOf } from '../lib/logic'
import { PageHead, Table, Badge, Mono, Empty, PatientBanner, Card, Button, Field, Icon, Hint, SearchBox, Modal, Tabs } from '../components/ui'

export function freeSlot(s, room = 'A') {
  const used = new Set(s.files.filter((f) => f.location).map((f) => locKey(f.location)))
  const r = STORAGE.rooms.find((x) => x.id === room)
  for (let rack = 1; rack <= r.racks; rack++) for (let shelf = 1; shelf <= STORAGE.shelves; shelf++) for (let pos = 1; pos <= STORAGE.positions; pos++) {
    const l = { room, rack, shelf, pos }
    if (!used.has(locKey(l))) return l
  }
  return null
}

export function LocationTrail({ loc, status }) {
  if (!loc) return <div className="trail trail-none"><Icon name="MapPin" size={15} /> No storage position assigned yet</div>
  const steps = [['Building2', STORAGE.rooms.find((r) => r.id === loc.room).name], ['Boxes', `Rack ${loc.rack}`], ['Layers', `Shelf ${loc.shelf}`], ['MapPin', `Position ${loc.pos}`]]
  return (
    <div className="trail" aria-label={`Location: ${locLabel(loc)}`}>
      {steps.map(([ic, l], i) => <span key={l} className="trail-step"><Icon name={ic} size={15} /><b>{l}</b>{i < 3 && <Icon name="ChevronRight" size={14} className="trail-arrow" />}</span>)}
      {status && <Badge>{status}</Badge>}
    </div>
  )
}

export default function Storage() {
  const { s, nav } = useStore()
  const params = s.route.params || {}
  const [room, setRoom] = useState('A')
  const [q, setQ] = useState('')
  const [target, setTarget] = useState(null)
  const name = (u) => patientOf(s, u)?.name || ''
  const awaiting = s.files.filter((f) => !f.location && f.status === 'Awaiting Storage')
  const exc = s.files.filter((f) => ['Missing', 'Damaged'].includes(f.status) || fileStatus(s, f) === 'Overdue')
  const found = q.length > 1 ? s.files.filter((f) => [name(f.uhid), f.uhid, f.ip, f.id].some((v) => v.toLowerCase().includes(q.toLowerCase()))).slice(0, 12) : []
  const sel = params.file && s.files.find((f) => f.id === params.file)
  const byKey = Object.fromEntries(s.files.filter((f) => f.location).map((f) => [locKey(f.location), f]))
  const r = STORAGE.rooms.find((x) => x.id === room)
  const counts = { total: r.racks * STORAGE.shelves * STORAGE.positions, used: s.files.filter((f) => f.location?.room === room).length }

  const clickCell = (l) => {
    const f = byKey[locKey(l)]
    if (f) { nav('storage', { file: f.id }); setTarget(null) }
    else if (sel && (!sel.location || sel.status === 'Available' || sel.status === 'Awaiting Storage')) setTarget(l)
  }

  return (
    <div className="page">
      <PageHead kicker="Physical records" title="File storage & retrieval" info="Every physical file has an exact home: Room › Rack › Shelf › Position. Click a slot to see which file is there." />
      <div className="storage-layout">
        <div className="storage-side">
          <SearchBox value={q} onChange={setQ} placeholder="Find a file: name, UHID, IP, file no." />
          {found.length > 0 && <ul className="pick">{found.map((f) => <li key={f.id}><button onClick={() => { nav('storage', { file: f.id }); setQ(''); f.location && setRoom(f.location.room) }}><strong>{name(f.uhid)}</strong><small><Mono>{f.id}</Mono> · {f.location ? locLabel(f.location) : 'no location'}</small><Badge>{fileStatus(s, f)}</Badge></button></li>)}</ul>}
          {q.length > 1 && !found.length && <p className="small muted">No matching records. Check the UHID or spelling.</p>}
          <h4 className="list-h">Awaiting storage <em>{awaiting.length}</em></h4>
          {awaiting.length ? <ul className="pick">{awaiting.map((f) => <li key={f.id}><button className={sel?.id === f.id ? 'on' : ''} onClick={() => { nav('storage', { file: f.id }); setTarget(freeSlot(s, room)) }}><strong>{name(f.uhid)}</strong><small><Mono>{f.id}</Mono> · closed record</small><Badge>Awaiting Storage</Badge></button></li>)}</ul> : <p className="small muted">All closed files have a location.</p>}
          <h4 className="list-h">Exceptions <em>{exc.length}</em></h4>
          <ul className="pick">{exc.map((f) => <li key={f.id}><button className={sel?.id === f.id ? 'on' : ''} onClick={() => { nav('storage', { file: f.id }); f.location && setRoom(f.location.room) }}><strong>{name(f.uhid)}</strong><small><Mono>{f.id}</Mono> · {f.custodian}</small><Badge>{fileStatus(s, f)}</Badge></button></li>)}</ul>
        </div>
        <div className="storage-main">
          {sel && <FilePanel f={sel} target={target} setTarget={setTarget} />}
          <Card title={`${r.name} · ${r.note}`} icon="Archive" actions={<Tabs value={room} onChange={setRoom} tabs={STORAGE.rooms.map((x) => ({ id: x.id, label: x.name }))} />}>
            <div className="legend">
              {[['Available', 'ok'], ['Requested', 'warn'], ['Issued', 'info'], ['Overdue', 'bad'], ['Missing', 'bad'], ['Empty', 'empty']].map(([l, t]) => <span key={l}><i className={`cell cell-${t} ${l === 'Missing' ? 'cell-missing' : ''}`} />{l}</span>)}
              <span className="muted">{counts.used}/{counts.total} positions used</span>
            </div>
            {sel && (!sel.location || sel.status === 'Awaiting Storage') && <Hint>Choose a free (dashed) position for <b>{name(sel.uhid)}</b>, or accept the suggested one.</Hint>}
            <div className="racks">
              {Array.from({ length: r.racks }, (_, i) => i + 1).map((rack) => (
                <div key={rack} className="rack">
                  <div className="rack-h">Rack {rack}</div>
                  {Array.from({ length: STORAGE.shelves }, (_, j) => j + 1).map((shelf) => (
                    <div key={shelf} className="shelf">
                      <span className="shelf-l">S{shelf}</span>
                      {Array.from({ length: STORAGE.positions }, (_, k) => k + 1).map((pos) => {
                        const l = { room, rack, shelf, pos }
                        const f = byKey[locKey(l)]
                        const st = f ? fileStatus(s, f) : 'Empty'
                        const tone = { Available: 'ok', Requested: 'warn', Issued: 'info', 'Return Pending': 'info', Overdue: 'bad', Missing: 'bad', Damaged: 'bad' }[st] || 'empty'
                        const isSel = f && sel?.id === f.id
                        const isTgt = target && locKey(target) === locKey(l)
                        return <button key={pos} className={`cell cell-${tone} ${st === 'Missing' ? 'cell-missing' : ''} ${isSel ? 'cell-sel' : ''} ${isTgt ? 'cell-tgt' : ''}`} onClick={() => clickCell(l)}
                          title={f ? `${name(f.uhid)} · ${f.id} · ${st}` : `Empty · Rack ${rack} Shelf ${shelf} Pos ${pos}`} aria-label={f ? `${name(f.uhid)}, ${st}, rack ${rack} shelf ${shelf} position ${pos}` : `Empty rack ${rack} shelf ${shelf} position ${pos}`} />
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function FilePanel({ f, target, setTarget }) {
  const { s, run, nav } = useStore()
  const e = encOf(s, f.ip)
  const st = fileStatus(s, f)
  const [miss, setMiss] = useState(false)
  const [reason, setReason] = useState('')
  const [moving, setMoving] = useState(false)
  const needs = !f.location || f.status === 'Awaiting Storage'
  const tgt = target || (needs ? freeSlot(s, 'A') : null)
  return (
    <Card title={`Physical file ${f.id}`} icon="FolderOpen" actions={<Button size="sm" icon="X" variant="ghost" aria-label="Close" onClick={() => nav('storage', {})} />}>
      {e && <PatientBanner ip={e.ip} compact />}
      <LocationTrail loc={f.location} status={st} />
      <dl className="dl">
        <dt>Volume</dt><dd>Vol. {f.volume}</dd>
        <dt>Current custodian</dt><dd>{f.custodian || 'MRD'}</dd>
        {f.issue && <><dt>Issued</dt><dd>{fmtDT(f.issue.at)} to {f.issue.to} ({f.issue.dept}) · return by <b className={st === 'Overdue' ? 't-bad' : ''}>{fmtDT(f.issue.expectedReturn)}</b></dd></>}
      </dl>
      {(needs || moving) && (
        <div className="assign">
          <div><small>{needs ? 'Suggested free position' : 'New position'}</small>{tgt ? <LocationTrail loc={tgt} /> : <p className="small">Click an empty slot below.</p>}</div>
          <div className="row-end">
            {moving && <Button onClick={() => { setMoving(false); setTarget(null) }}>Cancel</Button>}
            <Button variant="primary" icon="MapPin" disabled={!tgt} onClick={() => { if (run('ASSIGN_LOC', { id: f.id, loc: tgt, reason: moving ? 'Re-shelved' : '' }, `File stored at ${locLabel(tgt)}`).ok) { setTarget(null); setMoving(false) } }}>Store here</Button>
          </div>
        </div>
      )}
      <div className="row-end">
        {!needs && !moving && f.status === 'Available' && <Button size="sm" icon="Route" onClick={() => { setMoving(true); setTarget(null) }}>Move</Button>}
        {['Available', 'Issued'].includes(f.status) && <Button size="sm" icon="PackageX" onClick={() => setMiss(true)}>Mark missing</Button>}
        {['Missing', 'Damaged'].includes(f.status) && <Button size="sm" variant="primary" icon="PackageCheck" onClick={() => run('FILE_STATUS', { id: f.id, status: 'Available', reason: f.status === 'Missing' ? 'File traced and returned to position' : 'Repaired / pages secured' }, 'File restored to Available')}>{f.status === 'Missing' ? 'Mark found' : 'Mark repaired'}</Button>}
        {e && <Button size="sm" icon="Eye" onClick={() => nav('patient', { ip: e.ip, tab: 'file' })}>Patient 360°</Button>}
      </div>
      {f.history.length > 0 && <><h4 className="list-h">Movement history</h4><ul className="hist">{f.history.slice().reverse().map((h, i) => <li key={i}>{fmtDT(h.at)} · {h.by} — {h.action}</li>)}</ul></>}
      <Modal open={miss} onClose={() => setMiss(false)} title="Mark file missing" subtitle="Raises an incident for the MRD supervisor; the digital copy remains available."
        footer={<><Button onClick={() => setMiss(false)}>Cancel</Button><Button variant="danger" onClick={() => { if (run('FILE_STATUS', { id: f.id, status: 'Missing', reason }, 'File marked missing – supervisor alerted').ok) setMiss(false) }}>Mark missing</Button></>}>
        <Field label="Reason / last known whereabouts" required><textarea rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} /></Field>
      </Modal>
    </Card>
  )
}
