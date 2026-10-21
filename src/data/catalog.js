// Static reference data for the demo. All names, IDs and codes are fictitious / demo-only.

export const HOSPITAL = { name: 'Arogya Demo Multispeciality Hospital', city: 'Mumbai', short: 'ADMH' }

export const ROLES = [
  { id: 'nurse', label: 'Nursing / Ward Staff', short: 'Nursing', user: 'Sr. Anjali Pawar', title: 'Staff Nurse · Ward 7B & 8A', color: '#2f7d6d',
    blurb: 'Hands over discharged patients’ records to MRD.' },
  { id: 'receiving', label: 'MRD Receiving Staff', short: 'Receiving', user: 'Ramesh Kadam', title: 'MRD Receiving Counter', color: '#3b6ea8',
    blurb: 'Receives physical files and electronic documents.' },
  { id: 'scanning', label: 'Scanning / Digitization', short: 'Scanning', user: 'Pooja Shinde', title: 'Scanning Operator', color: '#7a5aa6',
    blurb: 'Scans paper documents and tags them to the patient.' },
  { id: 'qc', label: 'MRD Quality Checker', short: 'QC', user: 'Farhan Shaikh', title: 'QC Reviewer', color: '#b06a1f',
    blurb: 'Checks every scanned page before it becomes part of the record.' },
  { id: 'executive', label: 'MRD Executive / Records Manager', short: 'MRD Executive', user: 'Meera Iyer', title: 'MRD Executive & Coder', color: '#1d5c8c',
    blurb: 'Codes, checks completeness, stores files and fulfils requests.' },
  { id: 'requester', label: 'Requesting Department', short: 'Department', user: 'Dr. Vikram Rao', title: 'Consultant · Cardiology', dept: 'Cardiology', color: '#9c3d54',
    blurb: 'Requests, accepts and returns patient files.' },
  { id: 'supervisor', label: 'MRD Supervisor / Admin', short: 'Supervisor', user: 'Dr. Sunita Deshpande', title: 'MRD Manager', color: '#b8913f',
    blurb: 'Monitors TATs, escalations, exceptions and performance.' },
]
export const roleById = (id) => ROLES.find((r) => r.id === id)

// Individual demo users inside each user group (fictitious)
export const USERS = [
  { id: 'u-anjali', role: 'nurse', name: 'Sr. Anjali Pawar', title: 'Staff Nurse · Ward 7B Cardiac & 8A Medical' },
  { id: 'u-kavita', role: 'nurse', name: 'Sr. Kavita Jadhav', title: 'Staff Nurse · Ward 4B Maternity & 5A Surgical' },
  { id: 'u-ramesh', role: 'receiving', name: 'Ramesh Kadam', title: 'MRD Receiving Clerk · day shift' },
  { id: 'u-sneha', role: 'receiving', name: 'Sneha Patil', title: 'MRD Receiving Clerk · evening shift' },
  { id: 'u-pooja', role: 'scanning', name: 'Pooja Shinde', title: 'Scanning Operator · Station 1' },
  { id: 'u-amit', role: 'scanning', name: 'Amit Gawde', title: 'Scanning Operator · Station 2' },
  { id: 'u-farhan', role: 'qc', name: 'Farhan Shaikh', title: 'QC Reviewer' },
  { id: 'u-rina', role: 'qc', name: "Rina D'Costa", title: 'Senior QC Reviewer' },
  { id: 'u-meera', role: 'executive', name: 'Meera Iyer', title: 'MRD Executive & Coder' },
  { id: 'u-suresh', role: 'executive', name: 'Suresh Nair', title: 'Records Executive · Request Desk' },
  { id: 'u-vikram', role: 'requester', name: 'Dr. Vikram Rao', title: 'Consultant · Cardiology', dept: 'Cardiology' },
  { id: 'u-prakash', role: 'requester', name: 'Dr. Prakash Hegde', title: 'Consultant · Nephrology', dept: 'Nephrology' },
  { id: 'u-rekha', role: 'requester', name: 'Dr. Rekha Pillai', title: 'Consultant · Obstetrics & Gynaecology', dept: 'Obstetrics & Gynaecology' },
  { id: 'u-tpa', role: 'requester', name: 'Anita Sawant', title: 'Executive · Insurance / TPA Desk', dept: 'Insurance / TPA Desk' },
  { id: 'u-sunita', role: 'supervisor', name: 'Dr. Sunita Deshpande', title: 'MRD Manager' },
  { id: 'u-ashok', role: 'supervisor', name: 'Dr. Ashok Bhandari', title: 'Medical Superintendent' },
]
export const userById = (id) => USERS.find((u) => u.id === id)
export const defaultUser = (role) => USERS.find((u) => u.role === role)
export const currentUser = (s) => userById(s.userId) || defaultUser(s.role)

// "Things you can do" — free-exploration shortcuts per user group
export const ROLE_TASKS = {
  nurse: [['Hand over a discharged patient’s records', 'handover', {}], ['Simulate a new admission or discharge', 'handover', { tab: 'admitted' }], ['Track what you have sent to MRD', 'handover', { tab: 'sent' }], ['Look up any patient record', 'search', {}]],
  receiving: [['Verify & accept a physical file', 'receiving', {}], ['Start document intake for a received file', 'intake', {}], ['Watch electronic documents arrive', 'receiving', { tab: 'electronic' }], ['Resolve unmatched / unclassified documents', 'receiving', { tab: 'exceptions' }]],
  scanning: [['Scan or upload a received file, tag & map pages', 'intake', {}], ['Upload an outside / loose document', 'intake', { loose: 1 }], ['Quick-scan a single expected document', 'scanning', {}], ['Fix pages rejected by QC', 'scanning', { tab: 'rework' }]],
  qc: [['Review scanned pages & approve / reject', 'qc', {}], ['Look up a patient record', 'search', {}]],
  executive: [['Run completeness checks & ICD coding', 'coding', {}], ['Assign rack/shelf positions', 'storage', {}], ['Fulfil, issue or release requests', 'desk', {}], ['Inspect returned files', 'desk', { tab: 'returns' }], ['Add a document through intake', 'intake', {}]],
  requester: [['Request a complete file or a document', 'myrequests', { new: 1 }], ['Accept, report a problem or return a file', 'myrequests', {}], ['Search patient records', 'search', {}]],
  supervisor: [['Watch TAT breaches & resolve escalations', 'escalations', {}], ['Change TAT rules & move the clock', 'settings', {}], ['Waive a deficiency / reopen a record', 'coding', {}], ['Review the audit trail', 'audit', {}]],
}

// Navigation & page access per role
export const PAGES = {
  dashboard: { label: 'Dashboard', icon: 'LayoutDashboard' },
  handover: { label: 'Discharge Handover', icon: 'ClipboardList', hint: 'Ward → MRD' },
  intake: { label: 'Document Intake', icon: 'FileScan' },
  receiving: { label: 'MRD Receiving', icon: 'Inbox' },
  scanning: { label: 'Quick Scan & Rework', icon: 'ScanLine' },
  qc: { label: 'Quality Check', icon: 'ShieldCheck' },
  coding: { label: 'Coding & Completeness', icon: 'FileCheck2' },
  storage: { label: 'File Storage', icon: 'Archive' },
  desk: { label: 'Request Desk', icon: 'Send' },
  myrequests: { label: 'My Requests', icon: 'FolderSearch' },
  escalations: { label: 'TAT & Escalations', icon: 'Siren' },
  search: { label: 'Patient Records', icon: 'Search' },
  audit: { label: 'Audit Trail', icon: 'History' },
  settings: { label: 'Demo Settings', icon: 'Settings2' },
  scenarios: { label: 'Guided Demo', icon: 'CirclePlay' },
}

export const ROLE_PAGES = {
  nurse: ['dashboard', 'handover', 'search'],
  receiving: ['dashboard', 'receiving', 'intake', 'search'],
  scanning: ['dashboard', 'intake', 'scanning', 'search'],
  qc: ['dashboard', 'qc', 'search'],
  executive: ['dashboard', 'receiving', 'intake', 'coding', 'storage', 'desk', 'search'],
  requester: ['dashboard', 'myrequests', 'search'],
  supervisor: ['dashboard', 'escalations', 'receiving', 'intake', 'scanning', 'qc', 'coding', 'storage', 'desk', 'search', 'audit', 'settings'],
}
export const ALWAYS_PAGES = ['scenarios', 'patient', 'settings', 'start']

export const canAccess = (role, page) =>
  ROLE_PAGES[role]?.includes(page) || ALWAYS_PAGES.includes(page)

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
    coding: 72, // hours from QC pass to coding complete
    deficiency: 48, // default deficiency due period
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
