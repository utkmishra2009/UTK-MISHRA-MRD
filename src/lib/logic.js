import { checklistTypes, docType } from '../data/catalog'

export const H = 3600000

// ── formatting
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

// ── lookups
export const patientOf = (s, uhid) => s.patients.find((p) => p.uhid === uhid)
export const encOf = (s, ip) => s.encounters.find((e) => e.ip === ip)
export const fileOf = (s, id) => s.files.find((f) => f.id === id)
export const docsOf = (s, ip) => s.documents.filter((d) => d.ip === ip && d.status !== 'Entered in Error')

// ── encounter lifecycle stage (derived — single source of truth for all screens)
export const STAGES = ['Discharged', 'Handed over', 'Received', 'Digitized', 'QC passed', 'Coded & complete', 'Stored']
export function stageOf(s, e) {
  if (!e.discharged) return { key: 'admitted', label: 'Admitted', step: -1 }
  if (!e.handover) return { key: 'handover', label: 'Awaiting ward handover', step: 0 }
  if (e.handover.status === 'Submitted') return { key: 'receipt', label: 'Awaiting MRD receipt', step: 1 }
  const scans = docsOf(s, e.ip).filter((d) => d.kind === 'scanned')
  if (scans.some((d) => d.status === 'Awaiting Scan' || d.status === 'QC Rejected')) return { key: 'scanning', label: scans.some((d) => d.status === 'QC Rejected') ? 'Rescan required' : 'Awaiting scanning', step: 2 }
  if (scans.some((d) => d.status === 'QC Pending')) return { key: 'qc', label: 'Awaiting QC', step: 3 }
  if (e.record.status === 'Pending Review' || e.record.status === 'Incomplete' || e.record.status === 'Complete') {
    return { key: 'coding', label: e.record.status === 'Incomplete' ? 'Incomplete – deficiency open' : e.record.status === 'Complete' ? 'Complete – ready to close' : 'Awaiting coding & completeness', step: 4 }
  }
  if (e.record.status === 'Closed') {
    const f = fileOf(s, e.fileId)
    if (f && !f.location) return { key: 'storage', label: 'Awaiting storage location', step: 5 }
    return { key: 'stored', label: 'Closed & stored', step: 6 }
  }
  return { key: 'coding', label: 'Awaiting coding & completeness', step: 4 }
}

// what should happen next, in plain language (Patient 360)
export function nextAction(s, e) {
  const st = stageOf(s, e)
  return {
    admitted: ['Nursing / Ward', 'Patient is still admitted. Records go to MRD after discharge.'],
    handover: ['Nursing / Ward', 'Ward nurse should hand over the physical file and confirm electronic documents.'],
    receipt: ['MRD Receiving', 'MRD receiving staff should verify the file against the handover and accept it.'],
    scanning: ['Scanning', st.label === 'Rescan required' ? 'Scanning operator must rescan the pages rejected by QC.' : 'Scanning operator should scan and index the paper documents.'],
    qc: ['MRD Quality Checker', 'QC reviewer should check scanned pages and approve or reject.'],
    coding: ['MRD Executive', e.record.status === 'Complete' ? 'Record is complete — MRD executive can close it.' : 'MRD executive should complete the checklist and ICD coding.'],
    storage: ['MRD Executive', 'Assign a rack/shelf location to the physical file.'],
    stored: ['—', 'Record lifecycle complete. File is available for requests.'],
  }[st.key]
}

// ── completeness checklist
export function checklist(s, e) {
  const docs = docsOf(s, e.ip)
  const defs = s.deficiencies.filter((d) => d.ip === e.ip)
  return checklistTypes(e).map((type) => {
    const present = docs.filter((d) => d.type === type && (d.status === 'Filed' || d.status === 'Approved'))
    const pending = docs.filter((d) => d.type === type && ['Awaiting Scan', 'QC Pending', 'QC Rejected'].includes(d.status))
    const def = defs.filter((d) => d.type === type).sort((a, b) => b.raisedAt - a.raisedAt)[0]
    let state = present.length ? 'present' : pending.length ? 'processing' : 'missing'
    if (!present.length && def?.status === 'Waived') state = 'waived'
    return { type, name: docType(type).name, folder: docType(type).folder, state, docs: present, deficiency: def }
  })
}
export const openMandatoryDefs = (s, e) => s.deficiencies.filter((d) => d.ip === e.ip && (d.status === 'Open' || d.status === 'Responded'))

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
    if (s.now <= dueAt) return
    const over = s.now - dueAt
    out.push({ key, kind, ref, uhid: e?.uhid, ip: e?.ip, dueAt, over, level: over >= cfg.escalation.l2AfterHours * H ? 2 : 1, responsible, page })
  }
  for (const e of s.encounters) {
    if (e.archive || !e.discharged) continue
    if (!e.handover) push(`HO:${e.ip}`, 'Ward handover overdue', e.ip, e, e.discharged + cfg.tat.handover * H, `${e.ward} nursing`, 'handover')
    else if (e.handover.status === 'Submitted') push(`RC:${e.ip}`, 'MRD receipt overdue', e.handover.ref, e, e.handover.at + cfg.tat.receipt * H, 'MRD Receiving', 'receiving')
    else {
      const scans = docsOf(s, e.ip).filter((d) => d.kind === 'scanned')
      const waiting = scans.filter((d) => d.status === 'Awaiting Scan')
      if (waiting.length && e.handover.receivedAt) push(`SC:${e.ip}`, 'Scanning overdue', e.ip, e, e.handover.receivedAt + cfg.tat.scanning * H, 'Scanning', 'scanning')
      const qcp = scans.filter((d) => d.status === 'QC Pending')
      qcp.forEach((d) => push(`QC:${d.id}`, 'QC review overdue', d.id, e, d.receivedAt + cfg.tat.qc * H, 'MRD Quality Checker', 'qc'))
      if (['Pending Review', 'Incomplete'].includes(e.record.status) && e.record.since) push(`CD:${e.ip}`, 'Coding / completeness overdue', e.ip, e, e.record.since + cfg.tat.coding * H, 'MRD Executive', 'coding')
    }
  }
  for (const r of s.requests) {
    const e = encOf(s, r.ip)
    if (['Pending', 'On Hold'].includes(r.status)) push(`RQ:${r.id}`, 'Request fulfilment TAT breached', r.id, e, r.dueAt, 'MRD Executive (Request Desk)', 'desk')
    if (['Issued', 'Accepted', 'Discrepancy'].includes(r.status) && r.issue) push(`RT:${r.id}`, 'File return overdue', r.id, e, r.issue.expectedReturn, `${r.dept} – ${r.requester}`, 'desk')
  }
  for (const d of s.deficiencies) {
    if (d.status === 'Open') push(`DF:${d.id}`, 'Deficiency overdue', d.id, encOf(s, d.ip), d.dueAt, d.responsible, 'coding')
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
    return [p?.name, e.uhid, e.ip, e.dept, e.consultant, e.fileId, e.handover?.ref].some((v) => v && v.toLowerCase().includes(k))
  })
}
