// Static reference data for the demo. All names, IDs and codes are fictitious / demo-only.

export const HOSPITAL = { name: 'Arogya Demo Multispeciality Hospital', city: 'Mumbai', short: 'ADMH' }

// User groups. Role ids are kept stable; labels reflect the optimized MRD operating model.
export const ROLES = [
  { id: 'nurse', label: 'Ward Nurse', short: 'Nursing', user: 'Sr. Anjali Pawar', color: '#2f7d6d',
    blurb: 'Prepares discharged patients’ files and sends them to MRD; fixes nursing deficiencies.' },
  { id: 'receiving', label: 'MRD Receiving Staff', short: 'Receiving', user: 'Ramesh Kadam', color: '#3b6ea8',
    blurb: 'Acknowledges files at the MRD counter, or returns them to the ward with a reason.' },
  { id: 'qc', label: 'MRD Reviewer (QC)', short: 'Reviewer', user: 'Farhan Shaikh', color: '#b06a1f',
    blurb: 'Reviews each record, raises deficiencies, verifies corrections and accepts the record.' },
  { id: 'requester', label: 'Doctor / Clinical Department', short: 'Doctor', user: 'Dr. Vikram Rao', color: '#9c3d54',
    blurb: 'Resolves clinical deficiencies assigned to them and requests patient files.' },
  { id: 'scanning', label: 'Scanning & Digitization', short: 'Scanning', user: 'Pooja Shinde', color: '#7a5aa6',
    blurb: 'Scans or uploads paper documents and maps them to the patient’s record.' },
  { id: 'executive', label: 'MRD Records Officer', short: 'Records Officer', user: 'Meera Iyer', color: '#1d5c8c',
    blurb: 'Accepts and archives records, codes diagnoses, issues and receives back files.' },
  { id: 'supervisor', label: 'MRD Supervisor / Administrator', short: 'Supervisor', user: 'Dr. Sunita Deshpande', color: '#b8913f',
    blurb: 'Watches workload and TAT breaches, approves exceptions and waivers.' },
]
export const roleById = (id) => ROLES.find((r) => r.id === id)

const WARDS_ANJALI = ['Ward 7B Cardiac', 'Ward 8A Medical', 'ICU-2', 'Ward 3A Paeds', 'Day Care Oncology']
const WARDS_KAVITA = ['Ward 4B Maternity', 'Ward 5A Surgical', 'Ward 6C Ortho']
export const WARDS = [...WARDS_ANJALI, ...WARDS_KAVITA]

// Individual demo users inside each user group (fictitious)
export const USERS = [
  { id: 'u-anjali', role: 'nurse', name: 'Sr. Anjali Pawar', title: 'Staff Nurse · Ward 7B, 8A, ICU-2, 3A, Day Care', wards: WARDS_ANJALI },
  { id: 'u-kavita', role: 'nurse', name: 'Sr. Kavita Jadhav', title: 'Staff Nurse · Ward 4B, 5A, 6C', wards: WARDS_KAVITA },
  { id: 'u-ramesh', role: 'receiving', name: 'Ramesh Kadam', title: 'MRD Receiving Clerk · day shift' },
  { id: 'u-sneha', role: 'receiving', name: 'Sneha Patil', title: 'MRD Receiving Clerk · evening shift' },
  { id: 'u-farhan', role: 'qc', name: 'Farhan Shaikh', title: 'MRD Reviewer' },
  { id: 'u-rina', role: 'qc', name: "Rina D'Costa", title: 'Senior MRD Reviewer' },
  { id: 'u-vikram', role: 'requester', name: 'Dr. Vikram Rao', title: 'Consultant · Cardiology', dept: 'Cardiology' },
  { id: 'u-arvind', role: 'requester', name: 'Dr. Arvind Menon', title: 'Consultant · Internal Medicine', dept: 'Internal Medicine' },
  { id: 'u-sameer', role: 'requester', name: 'Dr. Sameer Joshi', title: 'Consultant · General Surgery', dept: 'General Surgery' },
  { id: 'u-prakash', role: 'requester', name: 'Dr. Prakash Hegde', title: 'Consultant · Nephrology', dept: 'Nephrology' },
  { id: 'u-rekha', role: 'requester', name: 'Dr. Rekha Pillai', title: 'Consultant · Obstetrics & Gynaecology', dept: 'Obstetrics & Gynaecology' },
  { id: 'u-tpa', role: 'requester', name: 'Anita Sawant', title: 'Executive · Insurance / TPA Desk', dept: 'Insurance / TPA Desk' },
  { id: 'u-pooja', role: 'scanning', name: 'Pooja Shinde', title: 'Scanning Operator · Station 1' },
  { id: 'u-amit', role: 'scanning', name: 'Amit Gawde', title: 'Scanning Operator · Station 2' },
  { id: 'u-meera', role: 'executive', name: 'Meera Iyer', title: 'MRD Records Officer & Coder' },
  { id: 'u-suresh', role: 'executive', name: 'Suresh Nair', title: 'Records Officer · File issue desk' },
  { id: 'u-sunita', role: 'supervisor', name: 'Dr. Sunita Deshpande', title: 'MRD Manager' },
  { id: 'u-ashok', role: 'supervisor', name: 'Dr. Ashok Bhandari', title: 'Medical Superintendent' },
]
export const userById = (id) => USERS.find((u) => u.id === id)
export const defaultUser = (role) => USERS.find((u) => u.role === role)
export const currentUser = (s) => userById(s.userId) || defaultUser(s.role)
export const userByName = (name) => USERS.find((u) => u.name === name)

// ── Record workflow: one status per encounter, changed only by workflow actions
export const WF = {
  ADMITTED: 'Admitted',
  NOT_SENT: 'Not Sent',
  RETURNED: 'Returned to Ward',
  AWAIT_RECEIPT: 'Awaiting Receipt',
  AWAIT_REVIEW: 'Awaiting Review',
  CORRECTIONS: 'Corrections Required',
  AWAIT_VERIFY: 'Awaiting Verification',
  READY: 'Ready for Acceptance',
  ARCHIVED: 'Accepted & Archived',
}
// Visual progress tracker (returns and corrections are shown as loops in the timeline)
export const LIFECYCLE = ['Discharged', 'Sent to MRD', 'Received', 'Reviewed', 'Corrections', 'Verified', 'Accepted', 'Archived']
export const WF_STEP = {
  [WF.ADMITTED]: -1, [WF.NOT_SENT]: 0, [WF.RETURNED]: 0, [WF.AWAIT_RECEIPT]: 1, [WF.AWAIT_REVIEW]: 2,
  [WF.CORRECTIONS]: 4, [WF.AWAIT_VERIFY]: 5, [WF.READY]: 6, [WF.ARCHIVED]: 8,
}

export const DEF_CATEGORIES = [
  { id: 'missing', label: 'Missing document', icon: 'FileX' },
  { id: 'incomplete', label: 'Incomplete documentation', icon: 'FileWarning' },
  { id: 'signature', label: 'Missing signature / authorization', icon: 'Pencil' },
  { id: 'incorrect', label: 'Incorrect / wrong document', icon: 'CircleX' },
  { id: 'clarification', label: 'Clinical clarification', icon: 'MessageSquare' },
]
export const defCat = (id) => DEF_CATEGORIES.find((c) => c.id === id) || DEF_CATEGORIES[0]

// "Things you can do" — free-exploration shortcuts per user group
export const ROLE_TASKS = {
  nurse: [['Prepare & send a discharged patient’s file', 'handover', {}], ['Fix a deficiency assigned to your ward', 'deficiencies', {}], ['See files returned by MRD', 'handover', { tab: 'notsent', status: 'Returned to Ward' }], ['Simulate a new admission or discharge', 'handover', { tab: 'admitted' }]],
  receiving: [['Acknowledge files waiting at the counter', 'receiving', { tab: 'receipt' }], ['Return a wrong / incomplete file to the ward', 'receiving', { tab: 'receipt' }], ['Start scanning for a received file', 'intake', {}], ['Track any patient record', 'tracking', {}]],
  qc: [['Review a received record', 'receiving', { tab: 'review' }], ['Verify submitted corrections', 'deficiencies', { tab: 'verify' }], ['Accept & archive ready records', 'receiving', { tab: 'ready' }], ['Check scanned pages', 'qc', {}]],
  requester: [['Resolve deficiencies assigned to you', 'deficiencies', {}], ['Request a patient file', 'myrequests', { new: 1 }], ['Track a patient record', 'tracking', {}]],
  scanning: [['Scan, tag & map a received file', 'intake', {}], ['Upload an outside / loose document', 'intake', { loose: 1 }], ['Fix pages rejected in scan QC', 'scanning', { tab: 'rework' }]],
  executive: [['Accept & archive ready records', 'receiving', { tab: 'ready' }], ['Fulfil file requests', 'desk', {}], ['See the archive rack map', 'storage', {}], ['Inspect returned files', 'desk', { tab: 'returns' }]],
  supervisor: [['See overdue work & escalations', 'escalations', {}], ['Waive a deficiency that cannot be fixed', 'deficiencies', { tab: 'all' }], ['Change TAT rules & move the clock', 'settings', {}], ['Review the audit log', 'audit', {}]],
}

// Navigation: six main screens + secondary tools
export const PAGES = {
  dashboard: { label: 'MRD Dashboard', icon: 'LayoutDashboard', main: true },
  handover: { label: 'Nurse Handover', icon: 'ClipboardList', main: true },
  receiving: { label: 'Receiving & QC', icon: 'Inbox', main: true },
  deficiencies: { label: 'Clinical Deficiencies', icon: 'FileWarning', main: true },
  intake: { label: 'Scanning & Documents', icon: 'FileScan', main: true },
  tracking: { label: 'Record Tracking', icon: 'Route', main: true },
  scanning: { label: 'Scanning & Documents', icon: 'FileScan', parent: 'intake' },
  qc: { label: 'Scanning & Documents', icon: 'FileScan', parent: 'intake' },
  desk: { label: 'File Requests', icon: 'Send' },
  myrequests: { label: 'My File Requests', icon: 'Send' },
  storage: { label: 'Archive Map', icon: 'Archive' },
  escalations: { label: 'TAT & Escalations', icon: 'Siren' },
  audit: { label: 'Audit Log', icon: 'History' },
  settings: { label: 'Demo Settings', icon: 'Settings2' },
  scenarios: { label: 'Guided Demo', icon: 'CirclePlay' },
}

export const ROLE_PAGES = {
  nurse: ['dashboard', 'handover', 'deficiencies', 'tracking'],
  receiving: ['dashboard', 'receiving', 'intake', 'tracking'],
  qc: ['dashboard', 'receiving', 'deficiencies', 'intake', 'tracking'],
  requester: ['dashboard', 'deficiencies', 'tracking', 'myrequests'],
  scanning: ['dashboard', 'intake', 'tracking'],
  executive: ['dashboard', 'receiving', 'deficiencies', 'intake', 'tracking', 'desk', 'storage'],
  supervisor: ['dashboard', 'handover', 'receiving', 'deficiencies', 'intake', 'tracking', 'desk', 'storage', 'escalations', 'audit', 'settings'],
}
export const ALWAYS_PAGES = ['scenarios', 'settings', 'start']
const ALIAS = { scanning: 'intake', qc: 'intake', patient: 'tracking', search: 'tracking' }

export const canAccess = (role, page) =>
  ROLE_PAGES[role]?.includes(page) || ROLE_PAGES[role]?.includes(ALIAS[page]) || ALWAYS_PAGES.includes(page)

// Document types. folder = classification tag (PRD minimum taxonomy).
export const DOC_TYPES = [
  { id: 'DS', name: 'Discharge Summary', folder: 'Clinical', src: 'EMR' },
  { id: 'IA', name: 'Initial Assessment', folder: 'Clinical', src: 'EMR' },
  { id: 'PN', name: 'Doctor Progress Notes', folder: 'Clinical', src: 'Physical', pages: 4 },
  { id: 'NN', name: 'Nursing Notes', folder: 'Nursing', src: 'Physical', pages: 4 },
  { id: 'MAR', name: 'Medication Administration Chart', folder: 'Nursing', src: 'Physical', pages: 3 },
  { id: 'TPR', name: 'TPR / Vitals Chart', folder: 'Nursing', src: 'Physical', pages: 2 },
  { id: 'IO', name: 'Intake–Output Chart', folder: 'Nursing', src: 'Physical', pages: 2 },
  { id: 'GC', name: 'General Consent', folder: 'Consent', src: 'Physical', pages: 2 },
  { id: 'SC', name: 'Procedure / Surgical Consent', folder: 'Consent', src: 'Physical', pages: 2 },
  { id: 'AC', name: 'Anaesthesia Consent', folder: 'Consent', src: 'Physical', pages: 1 },
  { id: 'OP', name: 'Operative / Procedure Notes', folder: 'Clinical', src: 'Physical', pages: 3 },
  { id: 'AR', name: 'Anaesthesia Record', folder: 'Clinical', src: 'Physical', pages: 2 },
  { id: 'PG', name: 'Partograph', folder: 'Clinical', src: 'Physical', pages: 2 },
  { id: 'LAB', name: 'Laboratory Report', folder: 'Investigation', src: 'LIS' },
  { id: 'RAD', name: 'Radiology Report', folder: 'Investigation', src: 'RIS' },
  { id: 'ECG', name: 'ECG Report', folder: 'Investigation', src: 'EMR' },
  { id: 'DAMA', name: 'DAMA / LAMA Form', folder: 'Legal', src: 'Physical', pages: 1 },
  { id: 'DTH', name: 'Death Summary', folder: 'Legal', src: 'EMR' },
  { id: 'INS', name: 'Insurance / TPA Form', folder: 'Billing', src: 'HIS' },
  { id: 'OTH', name: 'Other Document', folder: 'Other', src: 'Physical', pages: 1 },
]
export const docType = (id) => DOC_TYPES.find((d) => d.id === id) || { id, name: id, folder: 'Other' }
export const DOC_TAGS = ['Original', 'Photocopy', 'Handwritten', 'Signed', 'Unsigned', 'Outside hospital', 'Legal / MLC', 'Sensitive', 'Late entry', 'Legacy record']
export const FOLDERS = ['Clinical', 'Consent', 'Nursing', 'Investigation', 'Legal', 'Billing', 'Administrative', 'Other']

// Completeness checklist rules (demo configuration — hospital to confirm, PRD OQ-02)
export function checklistTypes(enc) {
  const list = ['DS', 'IA', 'PN', 'NN', 'MAR', 'GC', 'LAB']
  if (['procedure', 'surgery'].includes(enc.procedure)) list.push('SC', 'OP')
  if (enc.procedure === 'surgery') list.push('AC', 'AR')
  if (enc.procedure === 'delivery') list.push('SC', 'PG')
  if (enc.dischargeType === 'DAMA') list.push('DAMA')
  if (enc.dischargeType === 'Death') list.push('DTH')
  return list
}

// Small, clearly labelled DEMO ICD-10 catalogue (not a live lookup)
export const ICD = [
  ['I21.0', 'Acute transmural myocardial infarction of anterior wall', 'myocardial infarction anterior mi stemi lad ptca'],
  ['I21.9', 'Acute myocardial infarction, unspecified', 'myocardial infarction mi'],
  ['I25.1', 'Atherosclerotic heart disease', 'coronary artery disease cad cabg atherosclerotic'],
  ['I50.0', 'Congestive heart failure', 'heart failure chf'],
  ['I10', 'Essential (primary) hypertension', 'hypertension htn'],
  ['E11.1', 'Type 2 diabetes mellitus with ketoacidosis', 'diabetes ketoacidosis dka t2dm'],
  ['E11.9', 'Type 2 diabetes mellitus without complications', 'diabetes t2dm'],
  ['J18.9', 'Pneumonia, unspecified organism', 'pneumonia cap'],
  ['A09', 'Infectious gastroenteritis and colitis, unspecified', 'gastroenteritis diarrhoea age'],
  ['E86', 'Volume depletion (dehydration)', 'dehydration'],
  ['K35.8', 'Acute appendicitis, other and unspecified', 'appendicitis appendicectomy appendectomy'],
  ['K80.2', 'Calculus of gallbladder without cholecystitis', 'cholelithiasis gallstone cholecystectomy gallbladder'],
  ['K81.0', 'Acute cholecystitis', 'cholecystitis gallbladder'],
  ['O80', 'Single spontaneous delivery', 'normal delivery nvd vaginal'],
  ['O82', 'Single delivery by caesarean section', 'caesarean lscs section'],
  ['S82.2', 'Fracture of shaft of tibia', 'tibia fracture orif'],
  ['S72.0', 'Fracture of neck of femur', 'femur hip fracture'],
  ['I63.9', 'Cerebral infarction, unspecified', 'stroke cerebral infarction ischaemic'],
  ['N18.5', 'Chronic kidney disease, stage 5', 'ckd kidney renal dialysis'],
  ['C50.9', 'Malignant neoplasm of breast, unspecified', 'breast cancer carcinoma chemotherapy'],
  ['Z51.1', 'Encounter for antineoplastic chemotherapy', 'chemotherapy chemo cycle'],
  ['M17.1', 'Primary gonarthrosis, unilateral', 'knee osteoarthritis tkr'],
  ['N39.0', 'Urinary tract infection, site not specified', 'uti urinary'],
  ['A90', 'Dengue fever', 'dengue'],
  ['B54', 'Unspecified malaria', 'malaria'],
  ['G40.9', 'Epilepsy, unspecified', 'seizure epilepsy'],
].map(([code, desc, kw]) => ({ code, desc, kw }))

export const DEPARTMENTS = ['Cardiology', 'General Surgery', 'Orthopaedics', 'Obstetrics & Gynaecology', 'Internal Medicine', 'Neurology', 'Paediatrics', 'Nephrology', 'Oncology', 'Insurance / TPA Desk', 'Medico-Legal Cell', 'Quality / NABH']

// Physical storage hierarchy: Room → Rack → Shelf → Position
export const STORAGE = {
  rooms: [
    { id: 'A', name: 'MRD Room A', note: 'Current year IPD files', racks: 4 },
    { id: 'B', name: 'MRD Room B', note: 'Previous years / MLC cabinet', racks: 3 },
  ],
  shelves: 4,
  positions: 8,
}
export const locLabel = (l) => (l ? `${l.room === 'A' ? 'Room A' : 'Room B'} › Rack ${l.rack} › Shelf ${l.shelf} › Pos ${l.pos}` : '—')
export const locKey = (l) => (l ? `${l.room}-${l.rack}-${l.shelf}-${l.pos}` : '')

export const DEFAULT_CONFIG = {
  tat: {
    handover: 24, // hours after discharge for ward to hand over records
    receipt: 4, // hours for MRD to receive a submitted handover
    scanning: 24, // hours from receipt to scan
    qc: 12, // hours from scan to QC decision
    review: 24, // hours from MRD receipt to review completed
    verify: 24, // hours for MRD to verify a submitted correction
    deficiency: 48, // default time given to fix a deficiency
    returnPeriod: 48, // default physical file loan period
    accessWindow: 48, // electronic access window
    request: {
      Emergency: { Physical: 1, Electronic: 0.5 },
      Urgent: { Physical: 4, Electronic: 2 },
      Routine: { Physical: 24, Electronic: 8 },
    },
  },
  escalation: { l2AfterHours: 4 }, // overdue by ≥ this → Level 2 (Medical Superintendent)
}
