import { checklistTypes, docType, WF, USERS, defCat, locLabel, locKey, STORAGE } from '../data/catalog'

export const H = 3600000

// ── formatting (all times shown in IST)
const pad = (x) => String(x).padStart(2, '0')
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ist = (ms) => new Date(ms + 5.5 * H)
export const fmtDate = (ms) => { if (!ms) return '—'; const d = ist(ms); return `${pad(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
export const fmtTime = (ms) => { if (!ms) return '—'; const d = ist(ms); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }
export const fmtDT = (ms) => (ms ? `${fmtDate(ms)}, ${fmtTime(ms)}` : '—')
export const fmtShort = (ms) => { if (!ms) return '—'; const d = ist(ms); return `${pad(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${fmtTime(ms)}` }
export function fmtDur(ms) {
  const neg = ms < 0
  let m = Math.round(Math.abs(ms) / 60000)
  const d = Math.floor(m / 1440); m -= d * 1440
  const h = Math.floor(m / 60); m -= h * 60
  const s = d ? `${d}d ${h}h` : h ? `${h}h ${pad(m)}m` : `${m}m`
  return neg ? `-${s}` : s
}
export const toLocalInput = (ms) => { const d = ist(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }
export const fromLocalInput = (s) => Date.parse(`${s}:00+05:30`)
export const toDateInput = (ms) => toLocalInput(ms).slice(0, 10)
export const fromDateInput = (s, endOfDay) => Date.parse(`${s}T${endOfDay ? '23:59:59' : '00:00:00'}+05:30`)

// ── lookups
export const patientOf = (s, uhid) => s.patients.find((p) => p.uhid === uhid)
export const encOf = (s, ip) => s.encounters.find((e) => e.ip === ip)
export const fileOf = (s, id) => s.files.find((f) => f.id === id)
export const docsOf = (s, ip) => s.documents.filter((d) => d.ip === ip && d.status !== 'Entered in Error')

// ── Record workflow model ───────────────────────────────────────────────
// Four separate dimensions are tracked per encounter and never mixed up:
//   1. Workflow status   – e.status, changed only by workflow actions (store.jsx)
//   2. Physical custody  – where the paper file is (custodyOf)
//   3. Digital copy      – which documents exist digitally (digitalOf)
//   4. Task ownership    – who must act next (ownerOf)
// Encounters are always tracked separately, even when they share a UHID.
export const statusOf = (e) => e.status || WF.ADMITTED
export const isClosedWF = (e) => statusOf(e) === WF.ARCHIVED

export function wardNurses(ward) {
  return USERS.filter((u) => u.role === 'nurse' && u.wards?.includes(ward)).map((u) => u.name)
}
export const defAssigneeLabel = (d) => (d.assignee?.kind === 'ward' ? `${d.assignee.ward} nursing` : d.assignee?.name || '—')
export function defMatchesUser(d, user) {
  if (!user) return false
  if (user.role === 'supervisor') return true
  if (d.assignee?.kind === 'ward') return user.role === 'nurse' && !!user.wards?.includes(d.assignee.ward)
  return d.assignee?.name === user.name
}
export const defsOf = (s, ip) => s.deficiencies.filter((d) => d.ip === ip)
export const openDefs = (s, ip) => defsOf(s, ip).filter((d) => d.status === 'Open')
export const submittedDefs = (s, ip) => defsOf(s, ip).filter((d) => d.status === 'Correction Submitted')
export const activeDefs = (s, ip) => defsOf(s, ip).filter((d) => ['Open', 'Correction Submitted'].includes(d.status))

// Document checklist for one encounter: physical receipt, digital copy and review verdict per required item
export function checklist(s, e) {
  const docs = docsOf(s, e.ip)
  const h = e.handover
  return checklistTypes(e).map((type) => {
    const dt = docType(type)
    const electronic = dt.src !== 'Physical'
    const tdocs = docs.filter((d) => d.type === type)
    const item = h?.items?.find((i) => i.type === type)
    let physical = 'n/a'
    if (!electronic) {
      if (!h || h.status === 'Returned') physical = 'With ward'
      else if (!item) physical = 'Missing'
      else if (h.status === 'Submitted') physical = 'Sent'
      else physical = h.check?.notReceived?.includes(type) ? 'Not received' : 'Received'
    }
    const ok = tdocs.find((d) => d.status === 'Filed' || d.status === 'Approved')
    let digital = 'Not digitized'
    if (ok) digital = 'Available'
    else if (tdocs.some((d) => d.status === 'QC Pending')) digital = 'Scan QC pending'
    else if (tdocs.some((d) => d.status === 'QC Rejected')) digital = 'Rescan required'
    else if (tdocs.some((d) => d.status === 'Awaiting Scan')) digital = 'Not scanned'
    else if (electronic) digital = 'Not received from HMIS'
    const defs = s.deficiencies.filter((d) => d.ip === e.ip && d.docType === type).sort((a, b) => b.raisedAt - a.raisedAt)
    const verdict = e.review?.items?.[type] || null
    return { type, name: dt.name, folder: dt.folder, electronic, physical, digital, docs: tdocs, available: ok, item, verdict, defs, activeDef: defs.find((d) => ['Open', 'Correction Submitted'].includes(d.status)) }
  })
}

export function digitalOf(s, e) {
  const rows = checklist(s, e)
  const available = rows.filter((r) => r.digital === 'Available').length
  const pending = rows.filter((r) => ['Not scanned', 'Scan QC pending', 'Rescan required'].includes(r.digital)).length
  const extra = docsOf(s, e.ip).filter((d) => !rows.some((r) => r.type === d.type) && ['Filed', 'Approved'].includes(d.status)).length
  const label = !rows.length ? '—' : available === rows.length ? 'Fully digitized' : available === 0 ? 'Not digitized' : 'Partly digitized'
  return { available, total: rows.length, pending, extra, label }
}

export function custodyOf(s, e) {
  const f = fileOf(s, e.fileId)
  const st = statusOf(e)
  if (st === WF.ADMITTED || st === WF.NOT_SENT) return { label: `With ${e.ward}`, detail: st === WF.ADMITTED ? 'Patient still admitted' : 'Awaiting preparation by ward nurse', tone: 'warn' }
  if (st === WF.RETURNED) return { label: `Returned to ${e.ward}`, detail: e.handover?.returnReason || '', tone: 'bad' }
  if (st === WF.AWAIT_RECEIPT) return { label: 'In transit to MRD', detail: e.handover?.carrier || 'Ward attendant', tone: 'info' }
  if (!f) return { label: 'Electronic record only', detail: 'No physical file', tone: 'mute' }
  if (f.status === 'Issued') return { label: `Issued to ${f.issue?.dept || ''}`, detail: `${f.issue?.to} · due ${fmtShort(f.issue?.expectedReturn)}`, tone: s.now > f.issue?.expectedReturn ? 'bad' : 'info' }
  if (['Missing', 'Damaged'].includes(f.status)) return { label: `File ${f.status.toLowerCase()}`, detail: f.custodian || '', tone: 'bad' }
  if (f.location && st === WF.ARCHIVED) return { label: locLabel(f.location), detail: f.status === 'Return Pending' ? 'Returned – awaiting inspection' : 'Archived in MRD', tone: 'ok' }
  return { label: f.custodian || 'MRD', detail: 'Physical file in MRD', tone: 'info' }
}

export function ownerOf(s, e) {
  const st = statusOf(e)
  const since = e.statusAt || e.discharged || e.admitted
  const o = (team, names, action, page, params, due) => ({ team, names, action, page, params, since, due })
  switch (st) {
    case WF.ADMITTED: return o(e.ward, [], 'Awaiting discharge (HMIS)', 'tracking', { ip: e.ip })
    case WF.NOT_SENT: return o(`${e.ward} nursing`, wardNurses(e.ward), 'Prepare Handover', 'handover', { ip: e.ip }, e.discharged + s.config.tat.handover * H)
    case WF.RETURNED: return o(`${e.ward} nursing`, wardNurses(e.ward), 'Fix & Resend', 'handover', { ip: e.ip }, since + s.config.tat.handover * H)
    case WF.AWAIT_RECEIPT: return o('MRD Receiving', [], 'Receive Record', 'receiving', { ip: e.ip, open: 'receive' }, e.handover.at + s.config.tat.receipt * H)
    case WF.AWAIT_REVIEW: return o('MRD Reviewer', [], 'Review Record', 'receiving', { ip: e.ip, open: 'review' }, (e.handover?.receivedAt || since) + s.config.tat.review * H)
    case WF.CORRECTIONS: {
      const ds = openDefs(s, e.ip)
      return o([...new Set(ds.map(defAssigneeLabel))].join(', ') || 'Responsible clinicians', [], 'Resolve Issue', 'deficiencies', { ip: e.ip }, ds.length ? Math.min(...ds.map((d) => d.dueAt)) : null)
    }
    case WF.AWAIT_VERIFY: return o('MRD Reviewer', [], 'Verify Correction', 'deficiencies', { ip: e.ip, tab: 'verify' }, since + s.config.tat.verify * H)
    case WF.READY: return o('MRD Records Officer', [], 'Accept Record', 'receiving', { ip: e.ip, open: 'accept' }, since + s.config.tat.review * H)
    default: return o('MRD Archive', [], 'No action pending', 'tracking', { ip: e.ip })
  }
}

// ── One task model for every worklist (dashboard, receiving, deficiencies)
export const BUCKETS = [
  { id: 'notsent', label: 'Records Not Sent', icon: 'ClipboardList' },
  { id: 'receipt', label: 'Awaiting Receipt', icon: 'Package' },
  { id: 'review', label: 'Awaiting Review', icon: 'FileCheck2' },
  { id: 'corrections', label: 'Corrections Required', icon: 'FileWarning' },
  { id: 'verify', label: 'Awaiting Verification', icon: 'BadgeCheck' },
  { id: 'ready', label: 'Ready for Acceptance', icon: 'Archive' },
]
export function tasks(s) {
  const out = []
  for (const e of s.encounters) {
    if (e.archive || !e.discharged) continue
    const st = statusOf(e)
    const own = ownerOf(s, e)
    const base = { ip: e.ip, uhid: e.uhid, ward: e.ward, dept: e.dept, since: own.since, due: own.due }
    if (st === WF.NOT_SENT || st === WF.RETURNED) out.push({ ...base, key: `T-${e.ip}`, bucket: 'notsent', what: st === WF.RETURNED ? `Returned by MRD: ${e.handover?.returnReason || ''}` : e.prep ? 'Draft checklist saved – not yet sent' : 'File not yet prepared & sent to MRD', responsible: own.team, roles: ['nurse'], action: own.action, page: own.page, params: own.params })
    if (st === WF.AWAIT_RECEIPT) out.push({ ...base, key: `T-${e.ip}`, bucket: 'receipt', what: `Handover ${e.handover.ref} at MRD counter${e.handover.exception ? ' · sent with exception' : ''}`, responsible: own.team, roles: ['receiving', 'qc'], action: own.action, page: own.page, params: own.params })
    if (st === WF.AWAIT_REVIEW) out.push({ ...base, key: `T-${e.ip}`, bucket: 'review', what: e.review?.startedAt ? `Review in progress · ${Object.keys(e.review.items || {}).length}/${checklistTypes(e).length} items checked` : 'Received – review not started', responsible: own.team, roles: ['qc'], action: own.action, page: own.page, params: own.params })
    if (st === WF.READY) out.push({ ...base, key: `T-${e.ip}`, bucket: 'ready', what: 'Review complete · no open deficiencies', responsible: own.team, roles: ['executive', 'qc'], action: own.action, page: own.page, params: own.params })
  }
  for (const d of s.deficiencies) {
    const e = encOf(s, d.ip)
    if (!e) continue
    const base = { ip: d.ip, uhid: d.uhid, ward: e.ward, dept: e.dept, defId: d.id }
    if (d.status === 'Open') out.push({ ...base, key: `D-${d.id}`, bucket: 'corrections', what: `${defCat(d.category).label}: ${d.title}${d.reopened ? ` · reopened ×${d.reopened}` : ''}`, responsible: defAssigneeLabel(d), assignee: d.assignee, action: 'Resolve Issue', page: 'deficiencies', params: { def: d.id }, since: d.statusAt || d.raisedAt, due: d.dueAt })
    if (d.status === 'Correction Submitted') out.push({ ...base, key: `D-${d.id}`, bucket: 'verify', what: `Correction submitted: ${d.title}`, responsible: 'MRD Reviewer', roles: ['qc', 'executive'], action: 'Verify Correction', page: 'deficiencies', params: { def: d.id, tab: 'verify' }, since: d.statusAt, due: d.statusAt + s.config.tat.verify * H })
  }
  return out
}
// Which tasks are "mine" for the current user
export function myTasks(s, user) {
  const all = tasks(s)
  if (user.role === 'supervisor') return all.filter((t) => t.due && s.now > t.due)
  return all.filter((t) => {
    if (t.assignee) return defMatchesUser({ assignee: t.assignee }, user)
    if (!t.roles?.includes(user.role)) return false
    if (user.role === 'nurse') return !!user.wards?.includes(t.ward)
    return true
  })
}

// ── physical file display status (overdue is derived from due time, never typed)
export function fileStatus(s, f) {
  if (!f) return 'Not created'
  if (f.status === 'Issued' && f.issue && s.now > f.issue.expectedReturn) return 'Overdue'
  if (f.status === 'Available' && s.requests.some((r) => r.ip === f.ip && r.mode === 'Physical' && ['Pending', 'On Hold'].includes(r.status))) return 'Requested'
  return f.status
}

// ── request TAT
export const reqDue = (cfg, urgency, mode, at) => at + (cfg.tat.request[urgency]?.[mode] ?? 24) * H
export function reqTat(s, r) {
  if (['Pending', 'On Hold'].includes(r.status)) return { due: r.dueAt, left: r.dueAt - s.now, label: 'Fulfilment' }
  if (['Issued', 'Accepted', 'Discrepancy'].includes(r.status) && r.issue) return { due: r.issue.expectedReturn, left: r.issue.expectedReturn - s.now, label: 'Return' }
  return null
}

// ── TAT alerts: computed from the simulated clock and configured TATs
export function computeAlerts(s) {
  const cfg = s.config
  const out = []
  const push = (key, kind, ref, e, dueAt, responsible, page) => {
    if (!dueAt || s.now <= dueAt) return
    const over = s.now - dueAt
    out.push({ key, kind, ref, uhid: e?.uhid, ip: e?.ip, dueAt, over, level: over >= cfg.escalation.l2AfterHours * H ? 2 : 1, responsible, page })
  }
  for (const e of s.encounters) {
    if (e.archive || !e.discharged) continue
    const st = statusOf(e)
    const own = ownerOf(s, e)
    if (st === WF.NOT_SENT || st === WF.RETURNED) push(`HO:${e.ip}`, st === WF.RETURNED ? 'Returned file not resent' : 'Ward handover overdue', e.ip, e, own.due, own.team, 'handover')
    if (st === WF.AWAIT_RECEIPT) push(`RC:${e.ip}`, 'MRD receipt overdue', e.handover.ref, e, own.due, 'MRD Receiving', 'receiving')
    if (st === WF.AWAIT_REVIEW) push(`RV:${e.ip}`, 'MRD review overdue', e.ip, e, own.due, 'MRD Reviewer', 'receiving')
    if (st === WF.READY) push(`AC:${e.ip}`, 'Final acceptance overdue', e.ip, e, own.due, 'MRD Records Officer', 'receiving')
    const scans = docsOf(s, e.ip).filter((d) => d.kind === 'scanned')
    if (scans.some((d) => d.status === 'Awaiting Scan') && e.handover?.receivedAt) push(`SC:${e.ip}`, 'Scanning overdue', e.ip, e, e.handover.receivedAt + cfg.tat.scanning * H, 'Scanning', 'intake')
    scans.filter((d) => d.status === 'QC Pending').forEach((d) => push(`QC:${d.id}`, 'Scan QC overdue', d.id, e, d.receivedAt + cfg.tat.qc * H, 'MRD Reviewer', 'qc'))
  }
  for (const r of s.requests) {
    const e = encOf(s, r.ip)
    if (['Pending', 'On Hold'].includes(r.status)) push(`RQ:${r.id}`, 'Request fulfilment TAT breached', r.id, e, r.dueAt, 'MRD Records Officer (File Requests)', 'desk')
    if (['Issued', 'Accepted', 'Discrepancy'].includes(r.status) && r.issue) push(`RT:${r.id}`, 'File return overdue', r.id, e, r.issue.expectedReturn, `${r.dept} – ${r.requester}`, 'desk')
  }
  for (const d of s.deficiencies) {
    if (d.status === 'Open') push(`DF:${d.id}`, 'Deficiency overdue', d.id, encOf(s, d.ip), d.dueAt, defAssigneeLabel(d), 'deficiencies')
    if (d.status === 'Correction Submitted') push(`DV:${d.id}`, 'Correction verification overdue', d.id, encOf(s, d.ip), d.statusAt + cfg.tat.verify * H, 'MRD Reviewer', 'deficiencies')
  }
  return out.sort((a, b) => b.over - a.over)
}

export const levelLabel = (l) => (l === 2 ? 'L2 · Medical Superintendent' : 'L1 · MRD Supervisor')

// ── demo ICD suggestion: plain keyword match against diagnosis text (clearly labelled as demo)
export function suggestCodes(icd, text) {
  const t = (text || '').toLowerCase()
  return icd.filter((c) => c.kw.split(' ').some((k) => k.length > 2 && t.includes(k))).slice(0, 4)
}

export function searchRecords(s, q) {
  const k = q.trim().toLowerCase()
  if (!k) return []
  return s.encounters.filter((e) => {
    const p = patientOf(s, e.uhid)
    return [p?.name, e.uhid, e.ip, e.dept, e.ward, e.consultant, e.fileId, e.handover?.ref].some((v) => v && v.toLowerCase().includes(k))
  })
}

// Next free archive position (Room › Rack › Shelf › Position)
export function freeSlot(s, room = 'A') {
  const used = new Set(s.files.filter((f) => f.location).map((f) => locKey(f.location)))
  const r = STORAGE.rooms.find((x) => x.id === room)
  for (let rack = 1; rack <= r.racks; rack++) for (let shelf = 1; shelf <= STORAGE.shelves; shelf++) for (let pos = 1; pos <= STORAGE.positions; pos++) {
    const l = { room, rack, shelf, pos }
    if (!used.has(locKey(l))) return l
  }
  return null
}

