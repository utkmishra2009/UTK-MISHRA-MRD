// Seeded, fictitious demo data. No real patients. Timestamps are relative to the demo clock start.
import { DEFAULT_CONFIG, docType } from './catalog'

export const DEMO_START = Date.parse('2026-10-21T05:00:00Z') // 21 Oct 2026, 10:30 IST
const H = 3600000
const t = (h) => DEMO_START + h * H

let n = 0
const id = (p) => `${p}-${(++n).toString().padStart(4, '0')}`

export function buildSeed() {
  n = 0
  const patients = []
  const encounters = []
  const documents = []
  const files = []
  const requests = []
  const deficiencies = []
  const escalations = []
  const audit = []

  const log = (at, by, role, action, e, ref = '', remarks = '') =>
    audit.push({ id: id('A'), at, by, role, action, uhid: e?.uhid || '', ip: e?.ip || '', ref, remarks })

  const P = (uhid, name, age, sex, phone) => {
    const p = { uhid, name, age, sex, phone }
    patients.push(p)
    return p
  }
  const E = (o) => {
    const e = {
      ward: '', bed: '', consultant: '', procedure: 'none', dischargeType: 'Normal', diagnosis: '',
      discharged: null, handover: null, record: { status: 'Open' }, coding: { status: 'Pending', codes: [] }, fileId: null, ...o,
    }
    encounters.push(e)
    log(e.admitted, 'HIS (ADT feed – simulated)', 'system', 'Patient admitted', e, e.ip, `${e.ward}, Bed ${e.bed}`)
    if (e.discharged) log(e.discharged, 'HIS (ADT feed – simulated)', 'system', 'Discharge event received', e, e.ip, `${e.dischargeType} discharge`)
    return e
  }
  const pages = (k, defects = {}) => Array.from({ length: k }, (_, i) => ({ n: i + 1, defect: defects[i + 1] || null, rot: defects[i + 1] === 'rotated' ? 90 : 0, mark: null }))
  // Electronic document from a (simulated) source system
  const ED = (e, type, at, extra = {}) => {
    const dt = docType(type)
    const d = { id: id('D'), ip: e.ip, uhid: e.uhid, type, source: dt.src === 'Physical' ? 'EMR' : dt.src, kind: 'electronic', status: 'Filed', intake: 'Matched', pages: pages(type === 'DS' ? 2 : 1), docDate: at, receivedAt: at, by: `${dt.src} interface`, version: 1, qc: [], ...extra }
    documents.push(d)
    log(at, `${d.source} interface (simulated)`, 'system', `${dt.name} received & auto-filed`, e, d.id)
    return d
  }
  // Physical / scanned document
  const SD = (e, type, status, defects = {}, extra = {}) => {
    const dt = docType(type)
    const d = { id: id('D'), ip: e.ip, uhid: e.uhid, type, source: 'Physical', kind: 'scanned', status, pages: status === 'Awaiting Scan' ? [] : pages(dt.pages || 2, defects), expectedPages: dt.pages || 2, docDate: e.discharged || e.admitted, receivedAt: null, by: '', version: 1, qc: [], fileId: e.fileId, ...extra }
    documents.push(d)
    return d
  }
  const F = (e, status, loc, extra = {}) => {
    const f = { id: `PF-${e.ip.split('/').pop()}-V1`, ip: e.ip, uhid: e.uhid, volume: 1, status, location: loc, custodian: status === 'Available' ? 'MRD' : '', issue: null, history: [], ...extra }
    e.fileId = f.id
    files.push(f)
    return f
  }
  const handover = (e, at, by, items, missing = [], remarks = '', status = 'Submitted') => {
    e.handover = { ref: `HO-26-${(1800 + encounters.indexOf(e)).toString()}`, at, by, items, electronic: [], missing, remarks, status, receivedAt: null, receivedBy: null, check: null }
    log(at, by, 'nurse', 'Records handed over to MRD', e, e.handover.ref, `${items.length} physical item(s)${missing.length ? `; missing: ${missing.map((m) => docType(m).name).join(', ')}` : ''}`)
  }
  const receive = (e, at, by = 'Ramesh Kadam') => {
    e.handover.status = 'Received'
    e.handover.receivedAt = at
    e.handover.receivedBy = by
    e.handover.check = { identity: true, inventory: true, condition: 'Good' }
    log(at, by, 'receiving', 'Physical file received & verified', e, e.handover.ref, 'Identity, inventory and condition verified')
  }
  const items = (...types) => types.map((tp) => ({ type: tp, pages: docType(tp).pages || 2 }))

  // ───────────── 1. Currently admitted (nurse can simulate ADT discharge)
  P('UH-26-004781', 'Fatima Ansari', 34, 'F', '98200 41187')
  E({ ip: 'IP/26/10488', uhid: 'UH-26-004781', dept: 'Obstetrics & Gynaecology', ward: 'Ward 4B Maternity', bed: '412', consultant: 'Dr. Rekha Pillai', admitted: t(-26), procedure: 'delivery', diagnosis: 'Term pregnancy; elective LSCS' })
  P('UH-26-004802', 'Gurpreet Singh', 45, 'M', '98190 22654')
  E({ ip: 'IP/26/10495', uhid: 'UH-26-004802', dept: 'Orthopaedics', ward: 'Ward 6C Ortho', bed: '608', consultant: 'Dr. Nitin Bhave', admitted: t(-50), procedure: 'surgery', diagnosis: 'Fracture neck of femur (left); hemiarthroplasty' })

  // ───────────── 2. Discharged, awaiting ward handover  (Scenario 1 = Rohan Kulkarni)
  P('UH-26-004512', 'Rohan Kulkarni', 54, 'M', '98201 33412')
  const e1 = E({ ip: 'IP/26/10421', uhid: 'UH-26-004512', dept: 'Cardiology', ward: 'Ward 7B Cardiac', bed: '714', consultant: 'Dr. Vikram Rao', admitted: t(-122), discharged: t(-2.25), procedure: 'procedure', diagnosis: 'Acute anterior wall myocardial infarction; PTCA with stent to LAD. Essential hypertension.' })
  ED(e1, 'DS', t(-2.5)); ED(e1, 'IA', t(-121)); ED(e1, 'LAB', t(-100)); ED(e1, 'ECG', t(-121.5)); ED(e1, 'RAD', t(-96))

  P('UH-26-003377', 'Sunita Bhosale', 67, 'F', '98674 10982')
  const e2 = E({ ip: 'IP/26/10377', uhid: 'UH-26-003377', dept: 'Internal Medicine', ward: 'Ward 8A Medical', bed: '806', consultant: 'Dr. Arvind Menon', admitted: t(-160), discharged: t(-40.5), diagnosis: 'Community acquired pneumonia. Type 2 diabetes mellitus.' })
  ED(e2, 'DS', t(-41)); ED(e2, 'IA', t(-159)); ED(e2, 'LAB', t(-150)); ED(e2, 'RAD', t(-149))

  P('UH-26-004690', 'Aarav Mehta', 6, 'M', '99301 87120')
  const e3 = E({ ip: 'IP/26/10466', uhid: 'UH-26-004690', dept: 'Paediatrics', ward: 'Ward 3A Paeds', bed: '305', consultant: 'Dr. Swati Kelkar', admitted: t(-74), discharged: t(-3.5), diagnosis: 'Acute gastroenteritis with moderate dehydration.' })
  ED(e3, 'DS', t(-4)); ED(e3, 'IA', t(-73)); ED(e3, 'LAB', t(-70))

  // ───────────── 3. Handed over, awaiting MRD receipt (Scenario 2 = Lakshmi Narayanan)
  P('UH-26-002140', 'Lakshmi Narayanan', 72, 'F', '98211 55402')
  const e4 = E({ ip: 'IP/26/10402', uhid: 'UH-26-002140', dept: 'Nephrology', ward: 'Ward 8A Medical', bed: '812', consultant: 'Dr. Prakash Hegde', admitted: t(-140), discharged: t(-18.5), procedure: 'procedure', diagnosis: 'Chronic kidney disease stage 5; initiated on haemodialysis. Hypertension.' })
  ED(e4, 'DS', t(-19)); ED(e4, 'IA', t(-139)); ED(e4, 'LAB', t(-130))
  F(e4, 'In Transit', null)
  handover(e4, t(-1.3), 'Sr. Kavita Jadhav', items('NN', 'MAR', 'PN', 'GC', 'SC', 'OP', 'IO'))

  P('UH-26-004433', 'Imran Qureshi', 39, 'M', '97690 11208')
  const e5 = E({ ip: 'IP/26/10433', uhid: 'UH-26-004433', dept: 'General Surgery', ward: 'Ward 5A Surgical', bed: '521', consultant: 'Dr. Sameer Joshi', admitted: t(-70), discharged: t(-6), procedure: 'surgery', diagnosis: 'Acute appendicitis; laparoscopic appendicectomy.' })
  ED(e5, 'DS', t(-6.5)); ED(e5, 'IA', t(-69)); ED(e5, 'LAB', t(-68)); ED(e5, 'RAD', t(-68.5))
  F(e5, 'In Transit', null)
  handover(e5, t(-1.8), 'Sr. Anjali Pawar', items('NN', 'MAR', 'PN', 'GC', 'SC', 'AC', 'OP'), ['AR'], 'Anaesthesia record retained by OT for counter-signature; will be sent separately.')

  // ───────────── 4. Received, awaiting scanning (Scenario 3 = Priya Deshmukh)
  P('UH-26-004601', 'Priya Deshmukh', 29, 'F', '98922 61530')
  const e6 = E({ ip: 'IP/26/10411', uhid: 'UH-26-004601', dept: 'Obstetrics & Gynaecology', ward: 'Ward 4B Maternity', bed: '407', consultant: 'Dr. Rekha Pillai', admitted: t(-60), discharged: t(-20), procedure: 'delivery', diagnosis: 'Term pregnancy; normal vaginal delivery, single live birth.' })
  ED(e6, 'DS', t(-20.5)); ED(e6, 'IA', t(-59)); ED(e6, 'LAB', t(-58))
  F(e6, 'In Processing', null)
  handover(e6, t(-6), 'Sr. Kavita Jadhav', items('NN', 'MAR', 'PN', 'GC', 'SC', 'PG'))
  receive(e6, t(-1))
  ;['NN', 'MAR', 'PN', 'GC', 'SC', 'PG'].forEach((tp) => SD(e6, tp, 'Awaiting Scan'))

  P('UH-26-003958', "Joseph D'Souza", 61, 'M', '98330 40766')
  const e7 = E({ ip: 'IP/26/10358', uhid: 'UH-26-003958', dept: 'Neurology', ward: 'ICU-2', bed: 'ICU-09', consultant: 'Dr. Anil Kamat', admitted: t(-200), discharged: t(-52), diagnosis: 'Acute ischaemic stroke (left MCA territory). Hypertension.' })
  ED(e7, 'DS', t(-53)); ED(e7, 'IA', t(-199)); ED(e7, 'LAB', t(-190)); ED(e7, 'RAD', t(-198))
  F(e7, 'In Processing', null)
  handover(e7, t(-40), 'Sr. Meghna Rane', items('NN', 'MAR', 'PN', 'GC', 'TPR'))
  receive(e7, t(-30))
  SD(e7, 'NN', 'Approved', {}, { receivedAt: t(-26), by: 'Pooja Shinde' })
  SD(e7, 'MAR', 'Approved', {}, { receivedAt: t(-26), by: 'Pooja Shinde' })
  ;['PN', 'GC', 'TPR'].forEach((tp) => SD(e7, tp, 'Awaiting Scan'))

  // ───────────── 5. Scanned, awaiting QC (Scenario 4 = Kiran Patil, unclear op-note page)
  P('UH-26-004377', 'Kiran Patil', 48, 'M', '98190 77421')
  const e8 = E({ ip: 'IP/26/10394', uhid: 'UH-26-004377', dept: 'General Surgery', ward: 'Ward 5A Surgical', bed: '508', consultant: 'Dr. Sameer Joshi', admitted: t(-96), discharged: t(-30), procedure: 'surgery', diagnosis: 'Symptomatic cholelithiasis; laparoscopic cholecystectomy.' })
  ED(e8, 'DS', t(-31)); ED(e8, 'IA', t(-95)); ED(e8, 'LAB', t(-90)); ED(e8, 'RAD', t(-94))
  F(e8, 'In Processing', null)
  handover(e8, t(-22), 'Sr. Anjali Pawar', items('NN', 'MAR', 'PN', 'GC', 'SC', 'AC', 'OP', 'AR'))
  receive(e8, t(-20))
  ;['NN', 'MAR', 'PN', 'GC', 'SC', 'AC', 'AR'].forEach((tp) => SD(e8, tp, 'Approved', {}, { receivedAt: t(-8), by: 'Pooja Shinde', qc: [{ at: t(-5), by: 'Farhan Shaikh', decision: 'Approved', remarks: 'All pages clear' }] }))
  const op8 = SD(e8, 'OP', 'QC Pending', { 2: 'blur' }, { receivedAt: t(-3), by: 'Pooja Shinde' })
  log(t(-3), 'Pooja Shinde', 'scanning', 'Document scanned & indexed', e8, op8.id, 'Operative / Procedure Notes · 3 pages')

  P('UH-26-004120', 'Neha Gupta', 41, 'F', '98670 31290')
  const e9 = E({ ip: 'IP/26/10384', uhid: 'UH-26-004120', dept: 'Oncology', ward: 'Day Care Oncology', bed: 'DC-04', consultant: 'Dr. Farah Merchant', admitted: t(-54), discharged: t(-28), diagnosis: 'Carcinoma breast (right), cycle 3 of adjuvant chemotherapy.' })
  ED(e9, 'DS', t(-28.5)); ED(e9, 'IA', t(-53)); ED(e9, 'LAB', t(-52))
  F(e9, 'In Processing', null)
  handover(e9, t(-24), 'Sr. Meghna Rane', items('NN', 'MAR', 'PN', 'GC'))
  receive(e9, t(-22))
  ;['NN', 'MAR', 'PN', 'GC'].forEach((tp) => SD(e9, tp, 'QC Pending', tp === 'NN' ? { 4: 'rotated' } : {}, { receivedAt: t(-14), by: 'Pooja Shinde' }))

  // ───────────── 6. QC rejected → rework with scanning
  P('UH-26-003811', 'Harish Rawat', 58, 'M', '98201 99804')
  const e10 = E({ ip: 'IP/26/10340', uhid: 'UH-26-003811', dept: 'Cardiology', ward: 'Ward 7B Cardiac', bed: '709', consultant: 'Dr. Vikram Rao', admitted: t(-170), discharged: t(-60), diagnosis: 'Congestive heart failure (NYHA III). Hypertension.' })
  ED(e10, 'DS', t(-61)); ED(e10, 'IA', t(-169)); ED(e10, 'LAB', t(-160)); ED(e10, 'ECG', t(-169)); ED(e10, 'RAD', t(-165))
  F(e10, 'In Processing', null)
  handover(e10, t(-48), 'Sr. Anjali Pawar', items('NN', 'MAR', 'PN', 'GC'))
  receive(e10, t(-46))
  ;['MAR', 'PN', 'GC'].forEach((tp) => SD(e10, tp, 'Approved', {}, { receivedAt: t(-30), by: 'Pooja Shinde' }))
  const nn10 = SD(e10, 'NN', 'QC Rejected', { 3: 'cut' }, { receivedAt: t(-30), by: 'Pooja Shinde' })
  nn10.pages[2].mark = 'Incomplete'
  nn10.qc.push({ at: t(-20), by: 'Farhan Shaikh', decision: 'Rejected', remarks: 'Page 3 – right margin cut off; nursing entries for 14 Oct night shift not readable. Please rescan page 3.' })
  log(t(-20), 'Farhan Shaikh', 'qc', 'QC rejected – sent for rescan', e10, nn10.id, nn10.qc[0].remarks)

  // ───────────── 7. Coding & completeness (Scenario 5 = Mohan Verma, missing general consent)
  P('UH-26-003702', 'Mohan Verma', 70, 'M', '98190 66032')
  const e11 = E({ ip: 'IP/26/10329', uhid: 'UH-26-003702', dept: 'Internal Medicine', ward: 'Ward 8A Medical', bed: '803', consultant: 'Dr. Arvind Menon', admitted: t(-190), discharged: t(-70), diagnosis: 'Type 2 diabetes mellitus with diabetic ketoacidosis. Essential hypertension.' })
  ED(e11, 'DS', t(-71)); ED(e11, 'IA', t(-189)); ED(e11, 'LAB', t(-180))
  F(e11, 'In Processing', null)
  handover(e11, t(-60), 'Sr. Anjali Pawar', items('NN', 'MAR', 'PN', 'TPR'), ['GC'], 'General consent form not found in file at discharge.')
  receive(e11, t(-58))
  ;['NN', 'MAR', 'PN', 'TPR'].forEach((tp) => SD(e11, tp, 'Approved', {}, { receivedAt: t(-40), by: 'Pooja Shinde' }))
  e11.record = { status: 'Pending Review', since: t(-30) }
  e11.coding = { status: 'Pending', codes: [] }
  log(t(-30), 'Farhan Shaikh', 'qc', 'All scanned documents QC approved', e11, e11.ip)

  P('UH-26-003655', 'Sanjay Joshi', 52, 'M', '98330 12876')
  const e12 = E({ ip: 'IP/26/10318', uhid: 'UH-26-003655', dept: 'Orthopaedics', ward: 'Ward 6C Ortho', bed: '611', consultant: 'Dr. Nitin Bhave', admitted: t(-210), discharged: t(-96), procedure: 'surgery', diagnosis: 'Closed fracture shaft of tibia (right); ORIF with intramedullary nail.' })
  ED(e12, 'DS', t(-97)); ED(e12, 'IA', t(-209)); ED(e12, 'LAB', t(-205)); ED(e12, 'RAD', t(-208))
  F(e12, 'In Processing', null)
  handover(e12, t(-80), 'Sr. Kavita Jadhav', items('NN', 'MAR', 'PN', 'GC', 'SC', 'AC', 'OP', 'AR'))
  receive(e12, t(-78))
  ;['NN', 'MAR', 'PN', 'GC', 'SC', 'AC', 'OP', 'AR'].forEach((tp) => SD(e12, tp, 'Approved', {}, { receivedAt: t(-60), by: 'Pooja Shinde' }))
  e12.record = { status: 'Pending Review', since: t(-50) }

  // ───────────── 8. Coded & closed, awaiting storage location (Scenario 6 = Deepa Nair)
  P('UH-26-003590', 'Deepa Nair', 36, 'F', '98211 70345')
  const e13 = E({ ip: 'IP/26/10301', uhid: 'UH-26-003590', dept: 'Obstetrics & Gynaecology', ward: 'Ward 4B Maternity', bed: '402', consultant: 'Dr. Rekha Pillai', admitted: t(-260), discharged: t(-150), procedure: 'delivery', diagnosis: 'Term pregnancy, previous LSCS; repeat LSCS, single live birth.' })
  ED(e13, 'DS', t(-151)); ED(e13, 'IA', t(-259)); ED(e13, 'LAB', t(-255))
  F(e13, 'Awaiting Storage', null)
  handover(e13, t(-140), 'Sr. Kavita Jadhav', items('NN', 'MAR', 'PN', 'GC', 'SC', 'PG'))
  receive(e13, t(-138))
  ;['NN', 'MAR', 'PN', 'GC', 'SC', 'PG'].forEach((tp) => SD(e13, tp, 'Approved', {}, { receivedAt: t(-120), by: 'Pooja Shinde' }))
  e13.coding = { status: 'Coded', codes: [{ code: 'O82', desc: 'Single delivery by caesarean section', kind: 'Principal' }], coder: 'Meera Iyer', at: t(-8) }
  e13.record = { status: 'Closed', closedBy: 'Meera Iyer', closedAt: t(-7.5) }
  log(t(-8), 'Meera Iyer', 'executive', 'ICD coding completed', e13, 'O82')
  log(t(-7.5), 'Meera Iyer', 'executive', 'Record marked complete & closed', e13, e13.ip)

  // ───────────── 9. Stored, closed historical records used for requests
  const closedEnc = (uhid, name, age, sex, ip, dept, consultant, dx, code, desc, disH, loc, fileExtra = {}) => {
    P(uhid, name, age, sex, `98${Math.floor(100 + age * 7)} ${Math.floor(10000 + age * 913) % 90000 + 10000}`)
    const e = E({ ip, uhid, dept, ward: dept === 'Cardiology' ? 'Ward 7B Cardiac' : 'Ward 8A Medical', bed: `${700 + (age % 30)}`, consultant, admitted: t(disH - 120), discharged: t(disH), diagnosis: dx })
    ED(e, 'DS', t(disH - 1)); ED(e, 'IA', t(disH - 119)); ED(e, 'LAB', t(disH - 110))
    F(e, 'Available', loc, fileExtra)
    e.handover = { ref: `HO-26-${1200 + encounters.length}`, at: t(disH + 6), by: 'Sr. Kavita Jadhav', items: items('NN', 'MAR', 'PN', 'GC'), electronic: [], missing: [], remarks: '', status: 'Received', receivedAt: t(disH + 8), receivedBy: 'Ramesh Kadam', check: { identity: true, inventory: true, condition: 'Good' } }
    ;['NN', 'MAR', 'PN', 'GC'].forEach((tp) => SD(e, tp, 'Approved', {}, { receivedAt: t(disH + 20), by: 'Pooja Shinde' }))
    e.coding = { status: 'Coded', codes: [{ code, desc, kind: 'Principal' }], coder: 'Meera Iyer', at: t(disH + 40) }
    e.record = { status: 'Closed', closedBy: 'Meera Iyer', closedAt: t(disH + 41) }
    log(t(disH + 42), 'Meera Iyer', 'executive', 'File stored', e, e.fileId, `Location ${loc.room}-${loc.rack}-${loc.shelf}-${loc.pos}`)
    return e
  }

  // Scenario 7: department requests complete file (available)
  const e14 = closedEnc('UH-25-018834', 'Ramesh Agarwal', 66, 'M', 'IP/26/06120', 'Cardiology', 'Dr. Vikram Rao', 'Triple vessel coronary artery disease; CABG x3.', 'I25.1', 'Atherosclerotic heart disease', -2900, { room: 'A', rack: 2, shelf: 3, pos: 4 })
  // Scenario 8: issued, awaiting acceptance → discrepancy
  const e15 = closedEnc('UH-25-021190', 'Sushila Pandey', 59, 'F', 'IP/26/07744', 'Cardiology', 'Dr. Vikram Rao', 'Congestive heart failure; dilated cardiomyopathy.', 'I50.0', 'Congestive heart failure', -2100, { room: 'A', rack: 1, shelf: 2, pos: 6 })
  // Scenario 9: urgent request about to breach TAT
  const e16 = closedEnc('UH-24-009921', 'Vinod Chavan', 50, 'M', 'IP/26/05201', 'Cardiology', 'Dr. Vikram Rao', 'Acute inferior wall MI; primary PTCA to RCA.', 'I21.9', 'Acute myocardial infarction, unspecified', -3600, { room: 'A', rack: 3, shelf: 1, pos: 2 })
  // Scenario 10: accepted by department, to be returned
  const e17 = closedEnc('UH-25-030457', 'Arjun Malhotra', 44, 'M', 'IP/26/08012', 'Cardiology', 'Dr. Vikram Rao', 'Essential hypertension with hypertensive urgency.', 'I10', 'Essential (primary) hypertension', -1800, { room: 'A', rack: 2, shelf: 1, pos: 7 })
  // Overdue return (seeded supervisor exception)
  const e18 = closedEnc('UH-23-044120', 'Kamala Reddy', 75, 'F', 'IP/26/04410', 'Nephrology', 'Dr. Prakash Hegde', 'CKD stage 5 on maintenance haemodialysis.', 'N18.5', 'Chronic kidney disease, stage 5', -4200, { room: 'B', rack: 1, shelf: 4, pos: 3 })

  const issueFile = (e, req, at, to, expH) => {
    const f = files.find((x) => x.id === e.fileId)
    f.status = 'Issued'
    f.custodian = `${req.dept} – ${to}`
    f.issue = { reqId: req.id, at, by: 'Meera Iyer', to, dept: req.dept, expectedReturn: at + expH * H }
    req.issue = { ...f.issue }
  }
  const R = (o) => {
    const r = { id: `RQ-26-${(311 + requests.length).toString().padStart(4, '0')}`, mode: 'Physical', scope: 'Complete file', docIds: [], urgency: 'Routine', requiredBy: null, status: 'Pending', history: [], issue: null, acceptance: null, discrepancy: null, ret: null, holdReason: '', ...o }
    r.history.push({ at: r.createdAt, by: r.requester, action: 'Request submitted' })
    requests.push(r)
    return r
  }
  const cfg = DEFAULT_CONFIG.tat.request

  const r15 = R({ uhid: e15.uhid, ip: e15.ip, requester: 'Dr. Vikram Rao', dept: 'Cardiology', purpose: 'Follow-up OPD review – heart failure clinic', urgency: 'Routine', createdAt: t(-5), dueAt: t(-5) + cfg.Routine.Physical * H })
  issueFile(e15, r15, t(-1.5), 'Dr. Vikram Rao', 48)
  r15.status = 'Issued'
  r15.history.push({ at: t(-1.5), by: 'Meera Iyer', action: 'Physical file issued', note: 'Handed to Cardiology OPD runner (Sachin)' })
  log(t(-1.5), 'Meera Iyer', 'executive', 'Physical file issued', e15, r15.id, 'Expected return in 48 h')

  const r16 = R({ uhid: e16.uhid, ip: e16.ip, requester: 'Dr. Vikram Rao', dept: 'Cardiology', purpose: 'Insurance claim query – previous admission documents', urgency: 'Urgent', createdAt: t(-3), dueAt: t(-3) + cfg.Urgent.Physical * H })
  log(t(-3), 'Dr. Vikram Rao', 'requester', 'File request submitted', e16, r16.id, 'Urgent · Physical file')

  const r17 = R({ uhid: e17.uhid, ip: e17.ip, requester: 'Dr. Vikram Rao', dept: 'Cardiology', purpose: 'Second-opinion case discussion', urgency: 'Routine', createdAt: t(-50), dueAt: t(-50) + cfg.Routine.Physical * H })
  issueFile(e17, r17, t(-46), 'Dr. Vikram Rao', 72)
  r17.status = 'Accepted'
  r17.acceptance = { at: t(-45), by: 'Dr. Vikram Rao', note: 'File received complete' }
  r17.history.push({ at: t(-46), by: 'Meera Iyer', action: 'Physical file issued' }, { at: t(-45), by: 'Dr. Vikram Rao', action: 'Receipt accepted' })

  const r18 = R({ uhid: e18.uhid, ip: e18.ip, requester: 'Dr. Prakash Hegde', dept: 'Nephrology', purpose: 'Transplant work-up – past dialysis history', urgency: 'Routine', createdAt: t(-100), dueAt: t(-100) + cfg.Routine.Physical * H })
  issueFile(e18, r18, t(-96), 'Dr. Prakash Hegde', 48)
  r18.status = 'Accepted'
  r18.acceptance = { at: t(-95), by: 'Dr. Prakash Hegde' }
  r18.history.push({ at: t(-96), by: 'Meera Iyer', action: 'Physical file issued' }, { at: t(-95), by: 'Dr. Prakash Hegde', action: 'Receipt accepted' })

  // Electronic release already done (shows controlled access)
  const r19 = R({ uhid: e14.uhid, ip: e14.ip, requester: 'Anita Sawant', dept: 'Insurance / TPA Desk', purpose: 'TPA claim – discharge summary & bills', urgency: 'Routine', mode: 'Electronic', scope: 'Document', docIds: documents.filter((d) => d.ip === e14.ip && d.type === 'DS').map((d) => d.id), createdAt: t(-30), dueAt: t(-30) + cfg.Routine.Electronic * H })
  r19.status = 'Completed'
  r19.release = { at: t(-27), by: 'Meera Iyer', expiresAt: t(-27) + 48 * H, watermark: 'Released to Insurance / TPA Desk · RQ' }
  r19.history.push({ at: t(-27), by: 'Meera Iyer', action: 'Electronic access released (48 h, watermarked)' }, { at: t(-26), by: 'Anita Sawant', action: 'Documents viewed & acknowledged' })

  // ───────────── 10. Filler archive so the storage map looks like a real MRD room
  const first = ['Asha', 'Bhavesh', 'Chitra', 'Dinesh', 'Esha', 'Ganesh', 'Hema', 'Irfan', 'Jyoti', 'Kunal', 'Leela', 'Manoj', 'Nandini', 'Omkar', 'Pallavi', 'Rajesh', 'Shalini', 'Tushar', 'Usha', 'Varun', 'Yamini', 'Zubin', 'Alka', 'Bharat', 'Charu', 'Devendra', 'Ekta', 'Firoz', 'Geeta', 'Hitesh', 'Indu', 'Jagdish', 'Kalpana', 'Lalit']
  const last = ['Sawant', 'Gokhale', 'Iyer', 'Thakur', 'Kapoor', 'Naik', 'Chopra', 'Shetty', 'Bhatt', 'Desai', 'Pillai', 'Mishra', 'Kamble', 'Rao', 'Banerjee', 'Shah', 'Malik']
  const dx = [['I10', 'Essential (primary) hypertension', 'Internal Medicine'], ['J18.9', 'Pneumonia, unspecified organism', 'Internal Medicine'], ['K80.2', 'Calculus of gallbladder without cholecystitis', 'General Surgery'], ['O80', 'Single spontaneous delivery', 'Obstetrics & Gynaecology'], ['S72.0', 'Fracture of neck of femur', 'Orthopaedics'], ['A90', 'Dengue fever', 'Internal Medicine'], ['I63.9', 'Cerebral infarction, unspecified', 'Neurology'], ['M17.1', 'Primary gonarthrosis, unilateral', 'Orthopaedics'], ['N39.0', 'Urinary tract infection, site not specified', 'Nephrology']]
  const used = new Set(files.filter((f) => f.location).map((f) => `${f.location.room}-${f.location.rack}-${f.location.shelf}-${f.location.pos}`))
  let seed = 7
  const rnd = (m) => { seed = (seed * 9301 + 49297) % 233280; return Math.floor((seed / 233280) * m) }
  for (let i = 0; i < 46; i++) {
    let loc
    do {
      const room = rnd(10) < 7 ? 'A' : 'B'
      loc = { room, rack: 1 + rnd(room === 'A' ? 4 : 3), shelf: 1 + rnd(4), pos: 1 + rnd(8) }
    } while (used.has(`${loc.room}-${loc.rack}-${loc.shelf}-${loc.pos}`))
    used.add(`${loc.room}-${loc.rack}-${loc.shelf}-${loc.pos}`)
    const [code, desc, dept] = dx[i % dx.length]
    const name = `${first[i % first.length]} ${last[(i * 7) % last.length]}`
    const age = 22 + rnd(60)
    const uhid = `UH-${loc.room === 'B' ? '24' : '25'}-0${(12000 + i * 397).toString()}`
    const ip = `IP/26/0${(2000 + i * 83).toString()}`
    const disH = -(600 + i * 70)
    patients.push({ uhid, name, age, sex: i % 2 ? 'M' : 'F', phone: '—' })
    const e = { ip, uhid, dept, ward: '—', bed: '—', consultant: '—', procedure: 'none', dischargeType: 'Normal', diagnosis: desc, admitted: t(disH - 96), discharged: t(disH), handover: { ref: `HO-26-${(900 + i)}`, at: t(disH + 5), by: 'Ward staff', items: items('NN', 'MAR', 'PN', 'GC'), electronic: [], missing: [], remarks: '', status: 'Received', receivedAt: t(disH + 7), receivedBy: 'Ramesh Kadam', check: { identity: true, inventory: true, condition: 'Good' } }, record: { status: 'Closed', closedBy: 'Meera Iyer', closedAt: t(disH + 50) }, coding: { status: 'Coded', codes: [{ code, desc, kind: 'Principal' }], coder: 'Meera Iyer', at: t(disH + 48) }, fileId: `PF-${ip.split('/').pop()}-V1`, archive: true }
    encounters.push(e)
    files.push({ id: e.fileId, ip, uhid, volume: 1, status: i === 9 ? 'Missing' : 'Available', location: loc, custodian: 'MRD', issue: null, history: [] })
  }

  // Unmatched / unclassified electronic intake (exception queue)
  documents.push({ id: id('D'), ip: '', uhid: 'UH-26-00451', claimedName: 'ROHAN KULKARNI', type: 'LAB', source: 'LIS', kind: 'electronic', status: 'Exception', intake: 'Unmatched', reason: 'UHID in message does not exist (possible missing digit)', pages: [{ n: 1, defect: null, rot: 0 }], docDate: t(-4), receivedAt: t(-4), by: 'LIS interface', version: 1, qc: [] })
  documents.push({ id: id('D'), ip: 'IP/26/10402', uhid: 'UH-26-002140', type: 'UNMAPPED', claimedType: 'DIALYSIS_FLOWSHEET_V2', source: 'HIS', kind: 'electronic', status: 'Exception', intake: 'Unclassified', reason: 'Source document type is not mapped to an MRD document type', pages: [{ n: 1, defect: null, rot: 0 }], docDate: t(-7), receivedAt: t(-7), by: 'HIS interface', version: 1, qc: [] })

  audit.sort((a, b) => a.at - b.at)

  return {
    version: 4,
    now: DEMO_START,
    role: 'supervisor',
    userId: 'u-sunita',
    mode: null,
    batches: [],
    route: { page: 'start', params: {} },
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    patients, encounters, documents, files, requests, deficiencies, escalations, audit,
    guide: null,
    seq: 100,
  }
}

export { H }
