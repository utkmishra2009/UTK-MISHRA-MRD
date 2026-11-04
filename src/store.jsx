import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { buildSeed } from './data/seed'
import { docType, DOC_TYPES, currentUser, defaultUser, userById, WF, checklistTypes, defCat } from './data/catalog'
import { H, computeAlerts, encOf, fileOf, checklist, reqDue, patientOf, openDefs, submittedDefs, activeDefs, defAssigneeLabel, defMatchesUser, digitalOf } from './lib/logic'

const KEY = 'mrd-demo-state-v5'
const Ctx = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (s && s.version === 5) return s
    }
  } catch { /* storage unavailable – fall back to seed */ }
  return buildSeed()
}

const fail = (msg) => { throw new Error(msg) }

// Auto-create escalations for TAT breaches; auto-resolve when the underlying item is done.
function syncEscalations(s) {
  const alerts = computeAlerts(s)
  const keys = new Set(alerts.map((a) => a.key))
  for (const a of alerts) {
    const ex = s.escalations.find((x) => x.key === a.key && x.status !== 'Resolved')
    if (!ex) {
      s.escalations.push({ id: `ES-${++s.seq}`, key: a.key, auto: true, kind: a.kind, ref: a.ref, uhid: a.uhid, ip: a.ip, page: a.page, reason: a.kind, maxLevel: a.level, dueAt: a.dueAt, responsible: a.responsible, raisedAt: s.now, raisedBy: 'System (TAT rule)', status: 'Open', notes: [] })
      s.audit.push({ id: `A-${++s.seq}`, at: s.now, by: 'System (TAT rule)', role: 'system', action: `Escalation raised – ${a.kind}`, uhid: a.uhid || '', ip: a.ip || '', ref: a.ref, remarks: `Responsible: ${a.responsible}` })
    } else if (a.level > (ex.maxLevel || 1)) {
      ex.maxLevel = a.level
      ex.notes.push({ at: s.now, by: 'System (TAT rule)', text: 'Escalated to Level 2 – Medical Superintendent (overdue beyond threshold)' })
    }
  }
  for (const ex of s.escalations) {
    if (ex.auto && ex.status !== 'Resolved' && !keys.has(ex.key)) {
      ex.status = 'Resolved'
      ex.resolvedAt = s.now
      ex.resolution = 'Auto-closed: underlying task completed'
      ex.notes.push({ at: s.now, by: 'System', text: 'Underlying task completed – escalation closed' })
    }
  }
}

function apply(state, { type, p = {} }) {
  if (type === 'RESET') return { ...buildSeed(), role: state.role, userId: state.userId, mode: state.mode, route: state.route?.page === 'start' ? state.route : { page: 'dashboard', params: {} } }
  const s = structuredClone(state)
  const at = s.now
  const user = currentUser(s)
  const me = user.name
  const log = (action, e, ref = '', remarks = '', extra = {}) =>
    s.audit.push({ id: `A-${++s.seq}`, at: s.now, by: me, role: s.role, action, uhid: e?.uhid || '', ip: e?.ip || '', ref, remarks, ...extra })
  const E = (ip) => encOf(s, ip) || fail('Encounter not found')
  const D = (id) => s.documents.find((d) => d.id === id) || fail('Document not found')
  const R = (id) => s.requests.find((r) => r.id === id) || fail('Request not found')
  const newDocId = () => `D-${(++s.seq + 5000).toString()}`
  const DF = (id) => s.deficiencies.find((d) => d.id === id) || fail('Deficiency not found')
  const ownerLabel = (e, st) => ({ [WF.CORRECTIONS]: [...new Set(openDefs(s, e.ip).map(defAssigneeLabel))].join(', '), [WF.AWAIT_VERIFY]: 'MRD Reviewer', [WF.READY]: 'MRD Records Officer', [WF.AWAIT_REVIEW]: 'MRD Reviewer' }[st] || '')
  // Every workflow status change is written to the record history with previous → new status
  const setStatus = (e, to, action, ref = '', remarks = '', assigned = '', by = me, role = s.role) => {
    const from = e.status
    e.status = to
    e.statusAt = at
    s.audit.push({ id: `A-${++s.seq}`, at, by, role, action, uhid: e.uhid, ip: e.ip, ref, remarks, from, to, assigned })
  }
  // After deficiency activity, move the record to the status that matches the facts
  const recompute = (e) => {
    if (![WF.AWAIT_REVIEW, WF.CORRECTIONS, WF.AWAIT_VERIFY, WF.READY].includes(e.status)) return
    if (!e.review?.completedAt) return
    const open = openDefs(s, e.ip).length
    const sub = submittedDefs(s, e.ip).length
    const to = open ? WF.CORRECTIONS : sub ? WF.AWAIT_VERIFY : WF.READY
    if (to === e.status) return
    const msg = { [WF.CORRECTIONS]: 'Corrections required', [WF.AWAIT_VERIFY]: 'All corrections submitted – awaiting MRD verification', [WF.READY]: 'All deficiencies closed – ready for acceptance' }[to]
    setStatus(e, to, msg, e.ip, '', ownerLabel(e, to), 'System (workflow rule)', 'system')
  }
  switch (type) {
    case 'SET_ROLE': s.role = p.role; if (userById(s.userId)?.role !== p.role) s.userId = defaultUser(p.role).id; break
    case 'SET_USER': s.userId = p.userId; s.role = userById(p.userId).role; break
    case 'SET_MODE': s.mode = p.mode; break
    case 'SIM_ADMIT': {
      const F = ['Ritu', 'Sachin', 'Pooja', 'Arvind', 'Snehal', 'Tanvir', 'Madhuri', 'Kiran', 'Nilesh', 'Shabana', 'Ajay', 'Vaishali']
      const L = ['Kulkarni', 'Sheikh', 'Patwardhan', 'Fernandes', 'Rane', 'Bhosale', 'Agarwal', 'Menon', 'Chitnis', 'Lokhande']
      const k = ++s.seq
      const wards = [['Ward 7B Cardiac', 'Cardiology', 'Dr. Vikram Rao', 'none', 'Unstable angina'], ['Ward 8A Medical', 'Internal Medicine', 'Dr. Arvind Menon', 'none', 'Dengue fever with thrombocytopenia'], ['Ward 5A Surgical', 'General Surgery', 'Dr. Sameer Joshi', 'surgery', 'Inguinal hernia; open mesh repair'], ['Ward 4B Maternity', 'Obstetrics & Gynaecology', 'Dr. Rekha Pillai', 'delivery', 'Term pregnancy; normal vaginal delivery']]
      const [ward, dept, cons, proc, dx] = wards[k % wards.length]
      const uhid = `UH-26-00${5000 + k}`
      const ip = `IP/26/1${(600 + k).toString().padStart(4, '0')}`
      s.patients.push({ uhid, name: `${F[k % F.length]} ${L[(k * 3) % L.length]}`, age: 25 + (k * 7) % 50, sex: k % 2 ? 'M' : 'F', phone: '—' })
      s.encounters.push({ ip, uhid, dept, ward, bed: `${ward.match(/\d+/)?.[0] || 1}${(k % 20).toString().padStart(2, '0')}`, consultant: cons, procedure: proc, dischargeType: 'Normal', diagnosis: dx, admitted: at - 30 * H, discharged: null, handover: null, record: { status: 'Open' }, coding: { status: 'Pending', codes: [] }, fileId: null, status: WF.ADMITTED, statusAt: at, handovers: [], review: null })
      s.audit.push({ id: `A-${++s.seq}`, at, by: 'HIS (ADT feed – simulated)', role: 'system', action: 'Patient admitted', uhid, ip, ref: ip, remarks: `${ward} (simulated new admission)`, to: WF.ADMITTED })
      s.lastRef = ip
      break
    }
    case 'NAV': s.route = { page: p.page, params: p.params || {} }; break
    case 'CLOCK': {
      s.now += p.hours * H
      s.audit.push({ id: `A-${++s.seq}`, at: s.now, by: 'Demo clock', role: 'system', action: `Simulated clock advanced by ${p.hours} h`, uhid: '', ip: '', ref: '', remarks: '' })
      break
    }
    case 'CONFIG': {
      const path = p.path.split('.')
      let o = s.config
      path.slice(0, -1).forEach((k) => (o = o[k]))
      o[path.at(-1)] = p.value
      log('TAT / escalation configuration changed', null, p.path, `New value: ${p.value} h`)
      break
    }
    case 'GUIDE': s.guide = p.guide; break

    // ── Ward: discharge & handover preparation
    case 'SIM_DISCHARGE': {
      const e = E(p.ip)
      if (e.discharged) fail('Patient is already discharged')
      e.discharged = at
      e.dischargeType = p.dischargeType || 'Normal'
      e.record = { status: 'Open' }
      ;['DS', 'IA', 'LAB'].forEach((tp) => s.documents.push({ id: newDocId(), ip: e.ip, uhid: e.uhid, type: tp, source: docType(tp).src, kind: 'electronic', status: 'Filed', intake: 'Matched', pages: [{ n: 1, rot: 0 }, ...(tp === 'DS' ? [{ n: 2, rot: 0 }] : [])], docDate: at, receivedAt: at, by: `${docType(tp).src} interface`, version: 1, qc: [] }))
      setStatus(e, WF.NOT_SENT, 'Discharge event received', e.ip, `${e.dischargeType} discharge · EMR/LIS documents auto-filed`, `${e.ward} nursing`, 'HIS (ADT feed – simulated)', 'system')
      break
    }
    case 'SAVE_PREP': {
      const e = E(p.ip)
      if (![WF.NOT_SENT, WF.RETURNED].includes(e.status)) fail('This record has already been sent to MRD')
      e.prep = { ...p.prep, savedAt: at, savedBy: me }
      log('Handover checklist draft saved', e, e.ip, `${Object.values(p.prep.items || {}).filter((x) => x.present).length} item(s) ticked`)
      break
    }
    case 'SUBMIT_HANDOVER': {
      const e = E(p.ip)
      if (![WF.NOT_SENT, WF.RETURNED].includes(e.status)) fail('This record has already been sent to MRD')
      if (!p.items.length && !p.electronic?.length) fail('Select at least one document to hand over')
      const required = checklistTypes(e).filter((t) => docType(t).src === 'Physical')
      const missing = required.filter((t) => !p.items.some((i) => i.type === t))
      if (missing.length && !p.exception) fail(`${missing.length} required document(s) are missing. Add them, or send with an authorized exception.`)
      if (p.exception && (!p.exception.reason?.trim() || !p.exception.authorizedBy?.trim())) fail('An exception needs a reason and the name of the person who authorized it')
      if (p.exception && !p.exception.confirmed) fail('Confirm that the exception was authorized before sending')
      const version = (e.handovers?.length || 0) + (e.handover ? 2 : 1)
      if (e.handover) e.handovers = [...(e.handovers || []), e.handover]
      const ref = `HO-26-${++s.seq + 1900}`
      e.handover = { ref, version, at, by: me, items: p.items, electronic: p.electronic || [], missing, remarks: p.remarks || '', exception: p.exception || null, carrier: p.carrier || 'Ward attendant', status: 'Submitted', receivedAt: null, receivedBy: null, check: null }
      if (!e.fileId) {
        e.fileId = `PF-${e.ip.split('/').pop()}-V1`
        if (!fileOf(s, e.fileId)) s.files.push({ id: e.fileId, ip: e.ip, uhid: e.uhid, volume: 1, status: 'In Transit', location: null, custodian: 'In transit to MRD', issue: null, history: [] })
      }
      const f = fileOf(s, e.fileId)
      Object.assign(f, { status: 'In Transit', custodian: 'In transit to MRD' })
      f.history.push({ at, by: me, action: `Sent to MRD with ${p.carrier || 'ward attendant'} (${ref})` })
      e.prep = null
      setStatus(e, WF.AWAIT_RECEIPT, version > 1 ? `Handover resent to MRD (v${version})` : 'Handover sent to MRD', ref, `${p.items.length} physical document(s)${missing.length ? ` · missing: ${missing.map((m) => docType(m).name).join(', ')}` : ''}${p.exception ? ` · exception authorized by ${p.exception.authorizedBy}: ${p.exception.reason}` : ''}${p.remarks ? ` · ${p.remarks}` : ''}`, 'MRD Receiving')
      s.lastRef = ref
      break
    }

    // ── MRD receiving
    case 'RECEIVE_HANDOVER': {
      const e = E(p.ip)
      if (e.status !== WF.AWAIT_RECEIPT) fail('This record is not waiting for receipt')
      if (!p.identity) fail('Confirm patient identity (name, UHID and IP number on the file cover) before acknowledging receipt')
      const notReceived = e.handover.items.filter((it) => !p.received.includes(it.type)).map((it) => it.type)
      Object.assign(e.handover, { status: 'Received', receivedAt: at, receivedBy: me, check: { identity: true, inventory: notReceived.length === 0, condition: p.condition, remarks: p.remarks, notReceived } })
      const f = fileOf(s, e.fileId)
      if (f) { f.status = 'In Processing'; f.custodian = 'MRD review desk'; f.history.push({ at, by: me, action: 'Received at MRD counter' }) }
      e.handover.items.filter((it) => p.received.includes(it.type)).forEach((it) => {
        if (s.documents.some((d) => d.ip === e.ip && d.type === it.type && d.kind === 'scanned' && d.status !== 'Entered in Error')) return
        s.documents.push({ id: newDocId(), ip: e.ip, uhid: e.uhid, type: it.type, source: 'Physical', kind: 'scanned', status: 'Awaiting Scan', pages: [], expectedPages: it.pages, docDate: e.discharged, receivedAt: null, by: '', version: 1, qc: [], fileId: e.fileId })
      })
      e.review = null
      setStatus(e, WF.AWAIT_REVIEW, 'Receipt acknowledged at MRD counter', e.handover.ref, `Condition: ${p.condition}${notReceived.length ? ` · NOT received: ${notReceived.map((m) => docType(m).name).join(', ')}` : ' · inventory matched'}${p.remarks ? ` · ${p.remarks}` : ''}`, 'MRD Reviewer')
      if (notReceived.length || p.condition !== 'Good') {
        e.escalated = { at, by: me, reason: p.remarks || 'Handover inventory mismatch' }
        s.escalations.push({ id: `ES-${++s.seq}`, key: `MAN:${s.seq}`, auto: false, kind: p.condition !== 'Good' ? 'Damaged file at receipt' : 'Handover inventory mismatch', ref: e.handover.ref, uhid: e.uhid, ip: e.ip, page: 'receiving', reason: p.remarks || 'Items listed in handover not found in file', responsible: `${e.ward} nursing`, raisedAt: at, raisedBy: me, status: 'Open', notes: [] })
      }
      break
    }
    case 'RETURN_HANDOVER': {
      const e = E(p.ip)
      if (![WF.AWAIT_RECEIPT, WF.AWAIT_REVIEW].includes(e.status)) fail('Only records at receipt or review can be returned to the ward')
      if (!p.reason?.trim()) fail('Reason is mandatory when returning a file to the ward')
      Object.assign(e.handover, { status: 'Returned', returnedAt: at, returnedBy: me, returnReason: `${p.category ? `${p.category}: ` : ''}${p.reason}` })
      const f = fileOf(s, e.fileId)
      if (f) { f.status = 'With Ward'; f.custodian = e.ward; f.history.push({ at, by: me, action: `Returned to ${e.ward}: ${p.reason}` }) }
      e.review = null
      setStatus(e, WF.RETURNED, 'Returned to ward', e.handover.ref, e.handover.returnReason, `${e.ward} nursing`)
      break
    }
    case 'SIM_ARRIVAL': {
      const pool = s.encounters.filter((e) => !e.archive && e.discharged)
      const e = pool[(s.seq * 7) % pool.length]
      const tp = ['LAB', 'RAD', 'ECG', 'INS'][s.seq % 4]
      const late = e.record.status === 'Closed'
      const d = { id: newDocId(), ip: e.ip, uhid: e.uhid, type: tp, source: docType(tp).src, kind: 'electronic', status: 'Filed', intake: 'Matched', lateEntry: late, pages: [{ n: 1, rot: 0 }], docDate: at - 2 * H, receivedAt: at, by: `${docType(tp).src} interface`, version: 1, qc: [] }
      s.documents.push(d)
      s.audit.push({ id: `A-${++s.seq}`, at, by: `${d.source} interface (simulated)`, role: 'system', action: `${docType(tp).name} received & auto-filed${late ? ' – LATE ENTRY (record closed)' : ''}`, uhid: e.uhid, ip: e.ip, ref: d.id, remarks: '' })
      s.lastRef = d.id
      break
    }
    case 'LINK_DOC': {
      const d = D(p.id)
      const e = E(p.ip)
      d.ip = e.ip; d.uhid = e.uhid; d.status = 'Filed'; d.intake = 'Manually linked'
      if (p.type) d.type = p.type
      log(`Exception document ${p.type ? 'classified' : 'linked to patient'}`, e, d.id, `${docType(d.type).name}`)
      break
    }
    case 'RETURN_SOURCE': {
      const d = D(p.id)
      d.status = 'Returned to source'
      log('Exception document returned to source system', null, d.id, p.reason || '')
      break
    }

    // ── Scanning
    case 'SCAN_DOC': {
      const d = D(p.id)
      if (!p.confirmed) fail('Please confirm patient and encounter before uploading.')
      if (!['Awaiting Scan'].includes(d.status)) fail('Document is not awaiting scan')
      const count = Math.max(1, Number(p.pages) || d.expectedPages || 1)
      d.pages = Array.from({ length: count }, (_, i) => ({ n: i + 1, defect: p.defectPage === i + 1 ? p.defect : null, rot: p.defect === 'rotated' && p.defectPage === i + 1 ? 90 : 0, mark: null, upload: p.uploads?.[i] || null }))
      d.type = p.type || d.type
      d.folder = p.folder || docType(d.type).folder
      d.docDate = p.docDate || d.docDate
      d.status = 'QC Pending'
      d.receivedAt = at
      d.by = me
      d.tags = p.tags || []
      const e = E(d.ip)
      log('Document scanned & indexed', e, d.id, `${docType(d.type).name} · ${count} page(s) · source ${d.fileId || 'physical file'}`)
      break
    }
    case 'PAGE_FIX': {
      const d = D(p.id)
      const pg = d.pages.find((x) => x.n === p.n)
      if (p.action === 'rotate') pg.rot = (pg.rot + 90) % 360
      if (p.action === 'replace') { pg.defect = null; pg.rot = 0; pg.replaced = (pg.replaced || 0) + 1; pg.mark = null }
      if (p.action === 'retag') { pg.defect = null; pg.mark = null; pg.replaced = (pg.replaced || 0) + 1 }
      log(`Page ${p.n} ${p.action === 'replace' ? 'rescanned / replaced' : p.action === 'rotate' ? 'rotated' : 're-tagged'}`, E(d.ip), d.id)
      break
    }
    case 'RESUBMIT': {
      const d = D(p.id)
      if (d.status !== 'QC Rejected') fail('Only rejected documents can be resubmitted')
      d.status = 'QC Pending'
      d.version += 1
      d.receivedAt = at
      d.pages.forEach((pg) => (pg.mark = null))
      log('Corrected document resubmitted to QC', E(d.ip), d.id, `Rework version r${d.version}`)
      break
    }

    // ── Document intake: capture (scan / upload) → tag → map to patient file → submit to QC
    case 'INTAKE_NEW': {
      if (p.ip) {
        const ex = s.batches.find((b) => b.ip === p.ip && b.status === 'Draft' && b.source === 'Physical file')
        if (ex) { s.lastRef = ex.id; break }
      } else {
        const ex = s.batches.find((b) => !b.ip && b.status === 'Draft' && !b.pages.length && b.createdBy === me)
        if (ex) { s.lastRef = ex.id; break }
      }
      const e = p.ip ? E(p.ip) : null
      const b = { id: `IB-${(++s.seq + 400).toString()}`, ip: e?.ip || null, uhid: e?.uhid || null, fileId: e?.fileId || null, source: e ? 'Physical file' : 'Loose / external document', pages: [], docs: [], mapped: false, status: 'Draft', createdBy: me, createdAt: at, pageSeq: 0, docSeq: 0 }
      s.batches.push(b)
      log(`Document intake batch opened (${b.source})`, e, b.id)
      s.lastRef = b.id
      break
    }
    case 'INTAKE_CAPTURE': {
      const b = s.batches.find((x) => x.id === p.id) || fail('Batch not found')
      if (b.status !== 'Draft') fail('Batch already submitted')
      const add = (o) => b.pages.push({ id: `${b.id}-P${++b.pageSeq}`, defect: null, rot: 0, ...o })
      if (p.method === 'scan') {
        const expected = b.ip ? s.documents.filter((d) => d.ip === b.ip && d.status === 'Awaiting Scan').flatMap((d) => Array.from({ length: d.expectedPages || 1 }, () => d.type)) : []
        const n = Math.max(1, Number(p.count) || expected.length || 1)
        for (let i = 0; i < n; i++) add({ look: expected[i] || 'OTH', origin: 'Scanner', defect: p.defect && Number(p.defectPage) === i + 1 ? p.defect : null, rot: p.defect === 'rotated' && Number(p.defectPage) === i + 1 ? 90 : 0 })
        log(`${n} page(s) captured on scanner`, b.ip ? encOf(s, b.ip) : null, b.id, `Feeder batch${p.defect ? ' (demo defect simulated)' : ''}`)
      } else {
        if (!p.uploads?.length) fail('Choose at least one file')
        p.uploads.forEach((u) => add({ look: null, origin: 'Upload', upload: { name: u.name, src: u.src || null }, fingerprint: `${u.name}:${u.size}` }))
        log(`${p.uploads.length} file(s) uploaded`, b.ip ? encOf(s, b.ip) : null, b.id, p.uploads.map((u) => u.name).join(', '))
      }
      break
    }
    case 'INTAKE_PAGE': {
      const b = s.batches.find((x) => x.id === p.id)
      b.pages.filter((pg) => p.pageIds.includes(pg.id)).forEach((pg) => {
        if (p.action === 'discard') { pg.discarded = true; b.docs.forEach((d) => (d.pageIds = d.pageIds.filter((x) => x !== pg.id))) }
        if (p.action === 'restore') pg.discarded = false
        if (p.action === 'rotate') pg.rot = (pg.rot + 90) % 360
        if (p.action === 'rescan') { pg.defect = null; pg.rot = 0; pg.replaced = (pg.replaced || 0) + 1 }
      })
      b.docs = b.docs.filter((d) => d.pageIds.length)
      break
    }
    case 'INTAKE_TAG': {
      const b = s.batches.find((x) => x.id === p.id)
      if (!p.pageIds?.length) fail('Select the pages that make up this document')
      if (!p.type) fail('Choose a document type')
      if (!p.folder) fail('Choose a classification tag (folder)')
      if (!p.docDate) fail('Enter the document (clinical) date')
      b.docs.forEach((d) => (d.pageIds = d.pageIds.filter((x) => !p.pageIds.includes(x))))
      b.docs = b.docs.filter((d) => d.pageIds.length)
      const order = b.pages.map((x) => x.id)
      const pageIds = [...p.pageIds].sort((a, c) => order.indexOf(a) - order.indexOf(c))
      const d = { key: `${b.id}-D${++b.docSeq}`, type: p.type, folder: p.folder, tags: p.tags || [], docDate: p.docDate, author: p.author || '', placeholderId: p.placeholderId || null, pageIds }
      b.docs.push(d)
      log('Pages tagged as document', b.ip ? encOf(s, b.ip) : null, b.id, `${docType(p.type).name} · ${pageIds.length} page(s) · ${p.folder}${d.tags.length ? ` · tags: ${d.tags.join(', ')}` : ''}`)
      break
    }
    case 'INTAKE_UNTAG': {
      const b = s.batches.find((x) => x.id === p.id)
      b.docs = b.docs.filter((d) => d.key !== p.key)
      break
    }
    case 'INTAKE_MAP': {
      const b = s.batches.find((x) => x.id === p.id)
      if (!p.ip) fail('Select the patient and admission this batch belongs to')
      if (!p.confirmed) fail('Please confirm patient and encounter before mapping.')
      const e = E(p.ip)
      if (e.record.status === 'Closed') fail('Record is closed. Ask the MRD Manager to reopen it.')
      if (b.source === 'Physical file' && b.ip && b.ip !== p.ip) fail('A physical-file batch can only be mapped to the file it was received with. Use Return to ward / re-filing for a wrong file.')
      b.ip = e.ip; b.uhid = e.uhid; b.fileId = e.fileId; b.mapped = true; b.mappedBy = me; b.mappedAt = at
      log('Intake batch mapped to patient file', e, b.id, `${e.uhid} · ${e.ip}${e.fileId ? ` · ${e.fileId}` : ''}`)
      break
    }
    case 'INTAKE_SUBMIT': {
      const b = s.batches.find((x) => x.id === p.id)
      if (!b.mapped) fail('Map the batch to the patient file first')
      if (!b.docs.length) fail('Tag at least one document')
      const loose = b.pages.filter((pg) => !pg.discarded && !b.docs.some((d) => d.pageIds.includes(pg.id)))
      if (loose.length) fail(`${loose.length} page(s) are not tagged to a document. Tag them, or mark them as blank / separator sheets.`)
      const e = E(b.ip)
      if (e.record.status === 'Closed') fail('Record is closed. Ask the MRD Manager to reopen it.')
      const prints = b.pages.filter((pg) => pg.fingerprint).map((pg) => pg.fingerprint)
      const dup = prints.find((fp) => s.documents.some((d) => d.uhid === e.uhid && (d.fingerprint || '').split('|').includes(fp)))
      if (dup && !p.dupReason) fail('DUP:This file already exists for this patient. Enter a reason to continue.')
      const created = []
      b.docs.forEach((d) => {
        const ph = d.placeholderId && s.documents.find((x) => x.id === d.placeholderId && x.status === 'Awaiting Scan')
        if (ph) s.documents = s.documents.filter((x) => x.id !== ph.id)
        const pgs = d.pageIds.map((pid, i) => { const pg = b.pages.find((x) => x.id === pid); return { n: i + 1, defect: pg.defect, rot: pg.rot, mark: null, look: pg.look, upload: pg.upload || null, replaced: pg.replaced || 0 } })
        const uploaded = d.pageIds.some((pid) => b.pages.find((x) => x.id === pid).origin === 'Upload')
        const doc = { id: newDocId(), ip: e.ip, uhid: e.uhid, type: d.type, folder: d.folder, tags: d.tags, author: d.author, source: uploaded ? 'Upload' : 'Physical', kind: 'scanned', status: 'QC Pending', pages: pgs, expectedPages: ph?.expectedPages || pgs.length, docDate: d.docDate, receivedAt: at, by: me, version: 1, qc: [], fileId: uploaded && b.source !== 'Physical file' ? null : e.fileId, intakeBatch: b.id, uploaded, fingerprint: d.pageIds.map((pid) => b.pages.find((x) => x.id === pid).fingerprint).filter(Boolean).join('|'), dupReason: dup ? p.dupReason : undefined }
        s.documents.push(doc)
        created.push(doc.id)
      })
      if (e.record.status === 'Pending Review') e.record.status = 'Open'
      b.status = 'Submitted'; b.submittedAt = at; b.created = created
      log('Intake submitted to QC', e, b.id, `${created.length} document(s), ${b.pages.filter((x) => !x.discarded).length} page(s)${dup ? ` · duplicate override: ${p.dupReason}` : ''}`)
      break
    }
    case 'INTAKE_DELETE': {
      const b = s.batches.find((x) => x.id === p.id)
      if (b.status !== 'Draft') fail('Submitted batches cannot be deleted')
      s.batches = s.batches.filter((x) => x.id !== p.id)
      log('Draft intake batch discarded', b.ip ? encOf(s, b.ip) : null, b.id)
      break
    }

    // ── QC
    case 'QC_DECIDE': {
      const d = D(p.id)
      if (d.status !== 'QC Pending') fail('Document is not awaiting QC')
      if (p.decision === 'Rejected' && !p.remarks?.trim()) fail('Remarks are mandatory when rejecting a document')
      if (p.decision === 'Approved' && Object.values(p.marks).some((m) => m !== 'Clear')) fail('All pages must be marked Clear to approve. Reject the document if any page has an issue.')
      if (p.decision === 'Approved' && Object.keys(p.marks).length < d.pages.length) fail('Review and mark every page before approving')
      d.pages.forEach((pg) => (pg.mark = p.marks[pg.n] || null))
      d.status = p.decision === 'Approved' ? 'Approved' : 'QC Rejected'
      d.qc.push({ at, by: me, decision: p.decision, remarks: p.remarks || '', marks: p.marks, version: d.version })
      const e = E(d.ip)
      log(p.decision === 'Approved' ? 'QC approved' : 'QC rejected – sent for rescan', e, d.id, p.remarks || 'All pages clear')
      break
    }
    case 'ESCALATE': {
      if (!p.reason?.trim()) fail('Please describe why this is being escalated')
      const e = p.ip ? encOf(s, p.ip) : null
      if (e) e.escalated = { at, by: me, reason: p.reason }
      s.escalations.push({ id: `ES-${++s.seq}`, key: `MAN:${s.seq}`, auto: false, kind: p.kind, ref: p.ref, uhid: e?.uhid, ip: e?.ip, page: p.page, reason: p.reason, responsible: 'MRD Supervisor', raisedAt: at, raisedBy: me, status: 'Open', notes: [] })
      log(`Escalated to supervisor – ${p.kind}`, e, p.ref, p.reason, { assigned: 'MRD Supervisor', from: e?.status, to: e?.status })
      break
    }

    // ── MRD review (document-by-document)
    case 'REVIEW_ITEM': {
      const e = E(p.ip)
      if (e.status !== WF.AWAIT_REVIEW) fail('Review is only possible while the record is awaiting review')
      if (!e.review) { e.review = { items: {}, startedAt: at, by: me }; log('Review started', e, e.ip, '', { assigned: me }) }
      const types = p.types || [p.type]
      types.forEach((t) => { if (p.verdict) e.review.items[t] = p.verdict; else delete e.review.items[t] })
      break
    }
    case 'COMPLETE_REVIEW': {
      const e = E(p.ip)
      if (e.status !== WF.AWAIT_REVIEW) fail('This record is not awaiting review')
      const rows = checklist(s, e)
      const unchecked = rows.filter((r) => !e.review?.items?.[r.type])
      if (unchecked.length) fail(`${unchecked.length} checklist item(s) not yet checked: ${unchecked.map((r) => r.name).join(', ')}`)
      const issuesNoDef = rows.filter((r) => e.review.items[r.type] === 'issue' && !r.defs.length)
      if (issuesNoDef.length) fail(`Raise a deficiency for: ${issuesNoDef.map((r) => r.name).join(', ')}`)
      e.review.completedAt = at
      e.review.completedBy = me
      const open = openDefs(s, e.ip).length
      const sub = submittedDefs(s, e.ip).length
      const to = open ? WF.CORRECTIONS : sub ? WF.AWAIT_VERIFY : WF.READY
      setStatus(e, to, open ? 'Review completed – corrections required' : sub ? 'Review completed – corrections awaiting verification' : 'Review completed – no deficiencies', e.ip, `${rows.length} item(s) checked · ${activeDefs(s, e.ip).length} active deficiency(ies)`, ownerLabel(e, to))
      break
    }
    case 'SCAN_ITEM': {
      const e = E(p.ip)
      if (e.record?.status === 'Closed') fail('Record is closed. Ask the MRD Manager to reopen it.')
      const dt = docType(p.type)
      const n = Math.max(1, Number(p.pages) || dt.pages || 1)
      const pages = p.uploads?.length ? p.uploads.map((u, i) => ({ n: i + 1, defect: null, rot: 0, mark: null, upload: u })) : Array.from({ length: n }, (_, i) => ({ n: i + 1, defect: p.defect && Number(p.defectPage || 1) === i + 1 ? p.defect : null, rot: 0, mark: null }))
      let d = s.documents.find((x) => x.ip === e.ip && x.type === p.type && ['Awaiting Scan', 'QC Rejected'].includes(x.status))
      if (d) Object.assign(d, { pages, status: 'QC Pending', receivedAt: at, by: me, version: d.status === 'QC Rejected' ? d.version + 1 : d.version, folder: p.folder || dt.folder, tags: p.tags || d.tags || [] })
      else {
        d = { id: newDocId(), ip: e.ip, uhid: e.uhid, type: p.type, folder: p.folder || dt.folder, tags: p.tags || [], source: p.uploads?.length ? 'Upload' : 'Physical', kind: 'scanned', status: 'QC Pending', pages, expectedPages: pages.length, docDate: e.discharged || at, receivedAt: at, by: me, version: 1, qc: [], fileId: e.fileId, uploaded: !!p.uploads?.length }
        s.documents.push(d)
      }
      log(p.uploads?.length ? 'Document uploaded & tagged' : 'Document scanned & tagged', e, d.id, `${dt.name} · ${pages.length} page(s)${p.context ? ` · during ${p.context}` : ''}`)
      s.lastRef = d.id
      break
    }
    case 'VERIFY_SCAN': {
      const d = D(p.id)
      if (d.status !== 'QC Pending') fail('This scan is not waiting for verification')
      if (!p.ok && !p.remarks?.trim()) fail('Say what is wrong with the scan')
      d.pages.forEach((pg) => (pg.mark = p.ok ? 'Clear' : pg.defect ? 'Unclear' : 'Clear'))
      d.status = p.ok ? 'Approved' : 'QC Rejected'
      d.qc.push({ at, by: me, decision: p.ok ? 'Approved' : 'Rejected', remarks: p.remarks || 'All pages clear', version: d.version })
      log(p.ok ? 'Scan verified' : 'Scan rejected – rescan required', E(d.ip), d.id, p.remarks || `${docType(d.type).name} · all pages clear`)
      break
    }

    // ── Clinical deficiencies: raise → correct → verify (each with its own history)
    case 'RAISE_DEF': {
      const e = E(p.ip)
      if (![WF.AWAIT_REVIEW, WF.CORRECTIONS, WF.AWAIT_VERIFY, WF.READY].includes(e.status)) fail('Deficiencies can be raised only after MRD has received the record')
      if (!p.title?.trim()) fail('Give the deficiency a short title')
      if (!p.assignee || (p.assignee.kind === 'user' && !p.assignee.name) || (p.assignee.kind === 'ward' && !p.assignee.ward)) fail('Choose who must fix this deficiency')
      if (p.docType && activeDefs(s, e.ip).some((d) => d.docType === p.docType && d.category === p.category)) fail('An active deficiency of this type already exists for this document')
      const id = `DF-${++s.seq + 200}`
      const assigned = p.assignee.kind === 'ward' ? `${p.assignee.ward} nursing` : p.assignee.name
      const d = { id, ip: e.ip, uhid: e.uhid, category: p.category, docType: p.docType || null, title: p.title.trim(), description: p.description || '', assignee: p.assignee, raisedBy: me, raisedAt: at, dueAt: at + (Number(p.dueH) || s.config.tat.deficiency) * H, status: 'Open', statusAt: at, reopened: 0, corrections: [], history: [{ at, by: me, from: null, to: 'Open', action: 'Deficiency raised', remarks: p.description || p.title, assigned }] }
      s.deficiencies.push(d)
      if (p.docType && e.status === WF.AWAIT_REVIEW) { e.review = e.review || { items: {}, startedAt: at, by: me }; e.review.items[p.docType] = 'issue' }
      log('Deficiency raised', e, id, `${defCat(p.category).label}: ${d.title}`, { assigned })
      recompute(e)
      s.lastRef = id
      break
    }
    case 'SUBMIT_CORRECTION': {
      const d = DF(p.id)
      if (d.status !== 'Open') fail('This deficiency is not open for correction')
      if (!defMatchesUser(d, user)) fail(`This deficiency is assigned to ${defAssigneeLabel(d)}. Switch user to resolve it.`)
      if (!p.note || p.note.trim().length < 5) fail('Describe what you corrected (at least a few words)')
      const e = E(d.ip)
      let docId = null
      if (p.attach && d.docType) {
        const dt = docType(d.docType)
        const doc = { id: newDocId(), ip: e.ip, uhid: e.uhid, type: d.docType, folder: dt.folder, tags: ['Late entry', 'Signed'], source: p.attach === 'upload' ? 'Upload' : 'Physical', kind: 'scanned', status: 'QC Pending', pages: Array.from({ length: dt.pages || 1 }, (_, i) => ({ n: i + 1, defect: null, rot: 0, mark: null })), expectedPages: dt.pages || 1, docDate: at, receivedAt: at, by: me, version: 1, qc: [], fileId: e.fileId, viaDeficiency: d.id }
        s.documents.push(doc)
        docId = doc.id
      }
      d.corrections.push({ at, by: me, note: p.note.trim(), docId, method: p.attach || (d.category === 'signature' ? 'esign' : 'note') })
      d.history.push({ at, by: me, from: 'Open', to: 'Correction Submitted', action: 'Correction submitted', remarks: p.note.trim() })
      d.status = 'Correction Submitted'; d.statusAt = at
      log('Correction submitted', e, d.id, p.note.trim(), { assigned: 'MRD Reviewer' })
      recompute(e)
      break
    }
    case 'VERIFY_DEF': {
      const d = DF(p.id)
      if (d.status !== 'Correction Submitted') fail('There is no submitted correction to verify')
      if (!p.ok && !p.remarks?.trim()) fail('Give a reason for rejecting the correction – the responsible person will see it')
      const e = E(d.ip)
      const last = d.corrections.at(-1)
      const doc = last?.docId && s.documents.find((x) => x.id === last.docId)
      if (p.ok) {
        d.status = 'Verified'; d.statusAt = at; d.verifiedBy = me; d.verifiedAt = at
        if (doc) { doc.status = 'Approved'; doc.qc.push({ at, by: me, decision: 'Approved', remarks: 'Verified with deficiency correction', version: doc.version }) }
        if (d.docType && e.review?.items) e.review.items[d.docType] = 'ok'
        d.history.push({ at, by: me, from: 'Correction Submitted', to: 'Verified', action: 'Correction verified', remarks: p.remarks || '' })
        log('Correction verified', e, d.id, p.remarks || d.title)
      } else {
        d.status = 'Open'; d.statusAt = at; d.reopened = (d.reopened || 0) + 1; d.dueAt = at + s.config.tat.deficiency * H
        if (doc) { doc.status = 'QC Rejected'; doc.qc.push({ at, by: me, decision: 'Rejected', remarks: p.remarks, version: doc.version }) }
        last.rejected = { at, by: me, reason: p.remarks }
        d.history.push({ at, by: me, from: 'Correction Submitted', to: 'Open', action: 'Correction rejected – reopened', remarks: p.remarks, assigned: defAssigneeLabel(d) })
        log('Correction rejected – reopened', e, d.id, p.remarks, { assigned: defAssigneeLabel(d) })
      }
      recompute(e)
      break
    }
    case 'REOPEN_DEF': {
      const d = DF(p.id)
      if (d.status !== 'Verified') fail('Only verified deficiencies can be reopened')
      if (!p.reason?.trim()) fail('Reason is mandatory to reopen a deficiency')
      const e = E(d.ip)
      if (e.status === WF.ARCHIVED) fail('Record is archived. Ask the MRD Manager to reopen the record first.')
      d.status = 'Open'; d.statusAt = at; d.reopened = (d.reopened || 0) + 1; d.dueAt = at + s.config.tat.deficiency * H
      d.history.push({ at, by: me, from: 'Verified', to: 'Open', action: 'Deficiency reopened', remarks: p.reason, assigned: defAssigneeLabel(d) })
      log('Deficiency reopened', e, d.id, p.reason, { assigned: defAssigneeLabel(d) })
      recompute(e)
      break
    }
    case 'WAIVE_DEF': {
      const d = DF(p.id)
      if (s.role !== 'supervisor') fail('Only the MRD Manager / Supervisor can waive a deficiency')
      if (!['Open', 'Correction Submitted'].includes(d.status)) fail('Only active deficiencies can be waived')
      if (!p.reason?.trim()) fail('Waiver reason is mandatory')
      const e = E(d.ip)
      d.history.push({ at, by: me, from: d.status, to: 'Waived', action: 'Deficiency waived', remarks: p.reason })
      d.status = 'Waived'; d.statusAt = at
      if (d.docType && e.review?.items) e.review.items[d.docType] = 'ok'
      log('Deficiency waived', e, d.id, p.reason)
      recompute(e)
      break
    }
    case 'ADD_CODE': {
      const e = E(p.ip)
      if (e.coding.codes.some((c) => c.code === p.code.code)) fail('Code already added')
      const kind = p.kind || (e.coding.codes.some((c) => c.kind === 'Principal') ? 'Secondary' : 'Principal')
      e.coding.codes.push({ code: p.code.code, desc: p.code.desc, kind, viaSuggestion: !!p.suggested })
      e.coding.status = 'In Progress'
      log('ICD code added', e, p.code.code, `${kind}${p.suggested ? ' (accepted demo suggestion)' : ''}`)
      break
    }
    case 'REMOVE_CODE': {
      const e = E(p.ip)
      e.coding.codes = e.coding.codes.filter((c) => c.code !== p.code)
      if (!e.coding.codes.some((c) => c.kind === 'Principal') && e.coding.codes[0]) e.coding.codes[0].kind = 'Principal'
      log('ICD code removed', e, p.code)
      break
    }
    case 'SET_PRINCIPAL': {
      const e = E(p.ip)
      e.coding.codes.forEach((c) => (c.kind = c.code === p.code ? 'Principal' : 'Secondary'))
      log('Principal diagnosis changed', e, p.code)
      break
    }
    case 'COMPLETE_CODING': {
      const e = E(p.ip)
      if (!e.coding.codes.some((c) => c.kind === 'Principal')) fail('Add a principal diagnosis code before completing coding')
      e.coding.status = 'Coded'; e.coding.coder = me; e.coding.at = at
      log('ICD coding completed', e, e.coding.codes.map((c) => c.code).join(', '))
      break
    }
    // ── Final acceptance & archival
    case 'ACCEPT_RECORD': {
      const e = E(p.ip)
      if (e.status !== WF.READY) fail('Only records that are ready for acceptance can be accepted')
      if (activeDefs(s, e.ip).length) fail('Record has active deficiencies')
      const f = fileOf(s, e.fileId)
      const k = (l) => `${l.room}-${l.rack}-${l.shelf}-${l.pos}`
      if (f) {
        if (!p.loc) fail('Choose an archive position for the physical file')
        if (s.files.some((x) => x.id !== f.id && x.location && k(x.location) === k(p.loc))) fail('That archive position is already occupied')
        Object.assign(f, { location: p.loc, status: 'Available', custodian: 'MRD' })
        f.history.push({ at, by: me, action: `Archived at ${k(p.loc)}` })
      }
      const dg = digitalOf(s, e)
      e.record = { ...e.record, status: 'Closed', closedBy: me, closedAt: at }
      e.acceptance = { at, by: me, location: p.loc || null, digital: `${dg.available}/${dg.total} documents digital`, note: p.note || '' }
      setStatus(e, WF.ARCHIVED, 'Record accepted & archived', e.fileId || e.ip, `${p.loc ? `Location ${k(p.loc)}` : 'Electronic record'} · ${dg.available}/${dg.total} documents digital${dg.pending ? ` (${dg.pending} scan pending)` : ''}${p.note ? ` · ${p.note}` : ''}`, 'MRD Archive')
      break
    }
    case 'REOPEN': {
      const e = E(p.ip)
      if (s.role !== 'supervisor') fail('Only the MRD Manager can reopen an archived record')
      if (e.status !== WF.ARCHIVED) fail('Only archived records can be reopened')
      if (!p.reason?.trim()) fail('Reason is mandatory to reopen a record')
      e.record = { status: 'Open' }
      if (e.review) e.review.completedAt = null
      setStatus(e, WF.AWAIT_REVIEW, 'Record reopened for review', e.ip, p.reason, 'MRD Reviewer')
      break
    }

    // ── Storage
    case 'ASSIGN_LOC': {
      const f = fileOf(s, p.id)
      const k = (l) => `${l.room}-${l.rack}-${l.shelf}-${l.pos}`
      if (s.files.some((x) => x.id !== f.id && x.location && k(x.location) === k(p.loc))) fail('That position is already occupied')
      const prev = f.location
      f.location = p.loc
      if (['Awaiting Storage', 'In Processing', 'Available'].includes(f.status)) { f.status = 'Available'; f.custodian = 'MRD' }
      f.history.push({ at, by: me, action: prev ? `Moved from ${k(prev)} to ${k(p.loc)}` : `Stored at ${k(p.loc)}` })
      log(prev ? 'File location changed' : 'File stored', encOf(s, f.ip), f.id, `${k(p.loc)}${p.reason ? ` · ${p.reason}` : ''}`)
      break
    }
    case 'FILE_STATUS': {
      const f = fileOf(s, p.id)
      if (p.status === 'Missing' && !p.reason?.trim()) fail('Reason is mandatory')
      f.status = p.status
      f.custodian = p.status === 'Available' ? 'MRD' : f.custodian
      f.history.push({ at, by: me, action: `Marked ${p.status}${p.reason ? `: ${p.reason}` : ''}` })
      log(`Physical file marked ${p.status}`, encOf(s, f.ip), f.id, p.reason || '')
      if (p.status === 'Missing') s.escalations.push({ id: `ES-${++s.seq}`, key: `MAN:${s.seq}`, auto: false, kind: 'Physical file missing', ref: f.id, uhid: f.uhid, ip: f.ip, page: 'storage', reason: p.reason, responsible: 'MRD Supervisor', raisedAt: at, raisedBy: me, status: 'Open', notes: [] })
      break
    }

    // ── Requests
    case 'CREATE_REQ': {
      const e = E(p.ip)
      if (!p.purpose?.trim()) fail('Purpose is mandatory')
      if (p.scope === 'Document' && !p.docIds.length) fail('Select at least one document')
      const dupOpen = s.requests.find((r) => r.ip === e.ip && r.requester === me && r.mode === p.mode && ['Pending', 'On Hold'].includes(r.status))
      if (dupOpen) fail(`You already have an open request (${dupOpen.id}) for this record`)
      const id = `RQ-26-${(++s.seq + 300).toString().padStart(4, '0')}`
      const r = { id, uhid: e.uhid, ip: e.ip, requester: me, dept: user.dept || p.dept, purpose: p.purpose, urgency: p.urgency, mode: p.mode, scope: p.scope, docIds: p.docIds, requiredBy: p.requiredBy, createdAt: at, dueAt: reqDue(s.config, p.urgency, p.mode, at), status: 'Pending', history: [{ at, by: me, action: 'Request submitted' }], issue: null, acceptance: null, discrepancy: null, ret: null }
      s.requests.push(r)
      log('Record request submitted', e, id, `${p.urgency} · ${p.mode} · ${p.scope}`)
      s.lastRef = id
      break
    }
    case 'REQ_ACTION': {
      const r = R(p.id)
      const e = encOf(s, r.ip)
      const f = fileOf(s, e?.fileId)
      if (r.requester === me && ['issue', 'release', 'reject'].includes(p.action)) fail('You cannot approve a request you raised.')
      const H_ = (a, note) => r.history.push({ at, by: me, action: a, note })
      switch (p.action) {
        case 'hold': if (!p.reason?.trim()) fail('Reason is mandatory'); r.status = 'On Hold'; r.holdReason = p.reason; H_('Placed on hold', p.reason); break
        case 'resume': r.status = 'Pending'; H_('Resumed'); break
        case 'reject': if (!p.reason?.trim()) fail('Rejection reason is mandatory'); r.status = 'Rejected'; H_('Rejected', p.reason); break
        case 'cancel': r.status = 'Cancelled'; H_('Withdrawn by requester'); break
        case 'issue': {
          if (r.status !== 'Pending') fail('Request is not pending')
          if (!f || f.status !== 'Available') fail(`Physical file is not available for issue (current: ${f?.status || 'none'}${f?.custodian ? `, with ${f.custodian}` : ''})`)
          if (!p.to?.trim()) fail('Enter the name of the person receiving the file')
          f.status = 'Issued'; f.custodian = `${r.dept} – ${p.to}`
          f.issue = { reqId: r.id, at, by: me, to: p.to, dept: r.dept, expectedReturn: at + (Number(p.hours) || s.config.tat.returnPeriod) * H }
          f.history.push({ at, by: me, action: `Issued to ${p.to} (${r.dept}) against ${r.id}` })
          r.issue = { ...f.issue, note: p.note }
          r.status = 'Issued'
          H_('Physical file issued', `To ${p.to}; return due in ${Number(p.hours) || s.config.tat.returnPeriod} h`)
          break
        }
        case 'release': {
          if (r.status !== 'Pending') fail('Request is not pending')
          const hrs = Number(p.hours) || s.config.tat.accessWindow
          r.release = { at, by: me, expiresAt: at + hrs * H, watermark: `Released to ${r.requester} · ${r.id}` }
          r.status = 'Released'
          H_(`Electronic access released (${hrs} h window, watermarked)`)
          break
        }
        case 'accept': r.status = 'Accepted'; r.acceptance = { at, by: me, note: p.note }; H_('Receipt accepted', p.note); break
        case 'viewed': r.status = 'Completed'; H_('Documents viewed & acknowledged'); break
        case 'discrepancy': {
          if (!p.remarks?.trim()) fail('Please describe the discrepancy')
          r.status = 'Discrepancy'; r.discrepancy = { at, by: me, kind: p.kind, remarks: p.remarks, status: 'Open' }
          H_(`Discrepancy reported – ${p.kind}`, p.remarks)
          s.escalations.push({ id: `ES-${++s.seq}`, key: `MAN:${s.seq}`, auto: false, kind: `File discrepancy – ${p.kind}`, ref: r.id, uhid: r.uhid, ip: r.ip, page: 'desk', reason: p.remarks, responsible: 'MRD Supervisor', raisedAt: at, raisedBy: me, status: 'Open', notes: [], reqId: r.id })
          break
        }
        case 'return': {
          r.status = 'Return Submitted'; r.ret = { at, by: me, note: p.note }
          if (f) { f.status = 'Return Pending'; f.custodian = 'MRD return counter'; f.history.push({ at, by: me, action: 'Returned to MRD counter – awaiting inspection' }) }
          H_('File returned to MRD', p.note)
          break
        }
        case 'inspect': {
          if (r.status !== 'Return Submitted') fail('File has not been returned yet')
          if (!p.ok && !p.notes?.trim()) fail('Inspection notes are mandatory when the file is not in order')
          r.ret = { ...r.ret, inspectedAt: at, inspectedBy: me, ok: p.ok, notes: p.notes }
          r.status = 'Closed'
          if (f) {
            f.status = p.ok ? 'Available' : 'Damaged'
            f.custodian = 'MRD'
            f.issue = null
            f.history.push({ at, by: me, action: p.ok ? `Inspected OK – restored to ${f.location ? `${f.location.room}-${f.location.rack}-${f.location.shelf}-${f.location.pos}` : 'MRD'}` : `Inspection failed: ${p.notes}` })
          }
          H_(p.ok ? 'Return inspected & file restored to storage' : 'Return inspected – issue found', p.notes)
          if (!p.ok) s.escalations.push({ id: `ES-${++s.seq}`, key: `MAN:${s.seq}`, auto: false, kind: 'Damaged / incomplete file on return', ref: r.id, uhid: r.uhid, ip: r.ip, page: 'storage', reason: p.notes, responsible: 'MRD Supervisor', raisedAt: at, raisedBy: me, status: 'Open', notes: [] })
          break
        }
        default: fail('Unknown action')
      }
      log(`Request ${p.action}`, e, r.id, p.reason || p.note || p.remarks || p.notes || '')
      break
    }

    // ── Escalations
    case 'ESC_ACTION': {
      const x = s.escalations.find((y) => y.id === p.id)
      if (p.action === 'ack') { x.status = 'Acknowledged'; x.owner = p.owner || me; x.notes.push({ at, by: me, text: `Acknowledged; owner: ${x.owner}${p.note ? ` – ${p.note}` : ''}` }) }
      if (p.action === 'note') { if (!p.note?.trim()) fail('Enter a note'); x.notes.push({ at, by: me, text: p.note }) }
      if (p.action === 'resolve') {
        if (!p.note?.trim()) fail('Resolution notes are mandatory')
        x.status = 'Resolved'; x.resolvedAt = at; x.resolution = p.note; x.notes.push({ at, by: me, text: `Resolved: ${p.note}` })
        if (x.reqId) { const r = s.requests.find((q) => q.id === x.reqId); if (r?.discrepancy) { r.discrepancy.status = 'Resolved'; r.discrepancy.resolution = p.note; if (r.status === 'Discrepancy') r.status = 'Accepted'; r.history.push({ at, by: me, action: 'Discrepancy resolved by supervisor', note: p.note }) } }
      }
      log(`Escalation ${p.action}`, x.ip ? encOf(s, x.ip) : null, x.id, p.note || '')
      break
    }
    default: fail(`Unknown action ${type}`)
  }
  if (!['NAV', 'SET_ROLE', 'SET_USER', 'SET_MODE', 'GUIDE', 'CLOCK', 'INTAKE_PAGE', 'INTAKE_UNTAG'].includes(type)) s.now += 60000 // each action takes a simulated minute
  syncEscalations(s)
  return s
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(() => {
    const s = load()
    syncEscalations(s)
    if (!s.route) s.route = { page: 'start', params: {} }
    if (!s.batches) s.batches = []
    return s
  })
  const ref = useRef(state)
  ref.current = state
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const h = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ } }, 250)
    return () => clearTimeout(h)
  }, [state])

  const toast = useCallback((msg, kind = 'ok') => {
    const id = Math.random()
    setToasts((t) => [...t.slice(-2), { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 5000 : 2600)
  }, [])

  const run = useCallback((type, p, okMsg) => {
    try {
      const next = apply(ref.current, { type, p })
      ref.current = next
      setState(next)
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(next) : okMsg)
      return { ok: true, state: next }
    } catch (err) {
      const msg = err.message.startsWith('DUP:') ? err.message.slice(4) : err.message
      if (!err.message.startsWith('DUP:')) toast(msg, 'err')
      return { ok: false, error: msg, dup: err.message.startsWith('DUP:') }
    }
  }, [toast])

  const nav = useCallback((page, params = {}) => {
    run('NAV', { page, params })
    window.scrollTo?.({ top: 0 })
  }, [run])

  // Demo player support: take and restore whole-state snapshots (prevents duplicate data on restart)
  const snapshot = useCallback(() => ref.current, [])
  const restore = useCallback((st, patch = {}) => {
    const next = { ...st, ...patch }
    ref.current = next
    setState(next)
  }, [])

  // Record lifecycle drawer, available from every screen
  const [trackIp, setTrackIp] = useState(null)

  return <Ctx.Provider value={{ s: state, run, nav, toast, toasts, snapshot, restore, trackIp, openTrack: setTrackIp }}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
export { DOC_TYPES, patientOf }
