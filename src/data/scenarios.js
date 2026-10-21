// Guided demo scenarios. Each step knows which role/screen to open and how to detect completion from live state.
const enc = (s, ip) => s.encounters.find((e) => e.ip === ip)
const doc = (s, ip, type) => s.documents.find((d) => d.ip === ip && d.type === type && d.kind === 'scanned')
const req = (s, id) => s.requests.find((r) => r.id === id)
const batchFor = (s, ip) => s.batches.filter((b) => b.ip === ip).sort((a, b) => b.createdAt - a.createdAt)[0]
const looseFor = (s) => s.batches.filter((b) => b.source !== 'Physical file').sort((a, b) => b.createdAt - a.createdAt)[0]
const reqFor = (s, ip, by = 'Dr. Vikram Rao') => s.requests.filter((r) => r.ip === ip && r.requester === by).sort((a, b) => b.createdAt - a.createdAt)[0]

export const SCENARIOS = [
  {
    id: 's1', n: 1, title: 'Discharge to MRD', patient: 'Rohan Kulkarni', icon: 'ClipboardList',
    story: 'Rohan Kulkarni was discharged from the Cardiac ward this morning after an angioplasty. His paper file must reach MRD, together with confirmation of the electronic documents already in the EMR.',
    actor: 'Sr. Anjali Pawar — Ward nurse', action: 'Open Rohan from the discharge worklist, tick the physical documents in the file, note anything missing, and submit.',
    expected: 'A handover reference (HO-…) is generated, the file shows “In transit”, and the record appears in MRD’s receiving queue.',
    value: 'Replaces the paper handover register — MRD knows exactly what was sent, by whom and when, and missing items are flagged on day one.',
    steps: [
      { role: 'nurse', page: 'handover', params: { ip: 'IP/26/10421' }, text: 'Review the checklist for Rohan Kulkarni, keep the physical items ticked, and press “Submit to MRD”.', done: (s) => !!enc(s, 'IP/26/10421')?.handover },
      { role: 'receiving', page: 'receiving', params: { ip: 'IP/26/10421' }, text: 'Switch view: MRD Receiving now sees Rohan’s handover in its queue (already done for you). Click Next.' },
      { role: 'nurse', page: 'patient', params: { ip: 'IP/26/10421' }, text: 'The Patient 360° timeline shows the handover event with user, time and reference.' },
    ],
  },
  {
    id: 's2', n: 2, title: 'MRD receiving & verification', patient: 'Lakshmi Narayanan', icon: 'Inbox',
    story: 'Ward 8A has sent Lakshmi Narayanan’s file to the MRD counter. Before MRD takes custody, the clerk checks the patient identity, counts the documents against the handover list and notes the file’s condition.',
    actor: 'Ramesh Kadam — MRD receiving', action: 'Open the handover, confirm identity, verify each document, record condition and accept.',
    expected: 'Custody moves to MRD, each paper document becomes a scanning job, and any shortfall raises an exception automatically.',
    value: 'Clear chain of custody — disputes about “we sent it / we never got it” disappear.',
    steps: [
      { role: 'receiving', page: 'receiving', params: { ip: 'IP/26/10402' }, text: 'Open Lakshmi Narayanan’s handover, tick “Identity verified”, check the inventory and click “Accept into MRD”.', done: (s) => enc(s, 'IP/26/10402')?.handover?.status === 'Received' },
      { role: 'scanning', page: 'scanning', params: { ip: 'IP/26/10402' }, text: 'The scanning operator’s queue now contains her documents. Click Next.' },
    ],
  },
  {
    id: 's3', n: 3, title: 'Document intake: scan, tag & map', patient: 'Priya Deshmukh', icon: 'FileScan',
    story: 'Priya Deshmukh’s maternity file has been received in MRD. The operator scans the whole file in one go, splits the pages into documents, tags each one, and maps the batch to her patient file.',
    actor: 'Pooja Shinde — Scanning operator', action: 'Scan the file, tag each group of pages (type, folder, tags, date), confirm the patient file mapping, and submit to QC.',
    expected: 'Each tagged document is filed under Priya’s UHID, admission and physical file, reconciled against the ward’s handover list, and queued for QC.',
    value: 'No loose scans: every page is tied to a document type, a patient and its paper source, and anything missing from the handover is visible immediately.',
    steps: [
      { role: 'scanning', page: 'intake', params: { ip: 'IP/26/10411' }, text: 'Priya’s intake batch is open. In “Capture”, keep “Scan paper” and press “Start scan” (17 pages expected).', done: (s) => (batchFor(s, 'IP/26/10411')?.pages.length || 0) > 0 },
      { role: 'scanning', page: 'intake', params: { ip: 'IP/26/10411' }, text: 'Open step 2. Click an expected-document chip (e.g. “Nursing Notes 4p”) to select its pages, check the tags, then “Tag pages as document”. Repeat until all pages are tagged.', done: (s) => { const b = batchFor(s, 'IP/26/10411'); return !!b && b.docs.length > 0 && b.pages.every((pg) => pg.discarded || b.docs.some((d) => d.pageIds.includes(pg.id))) } },
      { role: 'scanning', page: 'intake', params: { ip: 'IP/26/10411' }, text: 'Step 3: confirm the documents belong to Priya Deshmukh and press “Map to patient file”. Check the handover reconciliation.', done: (s) => !!batchFor(s, 'IP/26/10411')?.mapped },
      { role: 'scanning', page: 'intake', params: { ip: 'IP/26/10411' }, text: 'Step 4: review and “Submit to QC”.', done: (s) => batchFor(s, 'IP/26/10411')?.status === 'Submitted' },
      { role: 'qc', page: 'qc', params: { ip: 'IP/26/10411' }, text: 'Her tagged documents are now in the QC reviewer’s worklist. Click Finish.' },
    ],
  },
  {
    id: 's4', n: 4, title: 'QC failure & correction', patient: 'Kiran Patil', icon: 'ShieldCheck',
    story: 'Page 2 of Kiran Patil’s operative notes was scanned out of focus. QC must catch it, send it back, and approve only after it is rescanned.',
    actor: 'Farhan Shaikh (QC) → Pooja Shinde (Scanning) → Farhan Shaikh', action: 'Mark page 2 as Unclear and reject with remarks; rescan the page; re-review and approve.',
    expected: 'The rework history (who, when, why) is kept; once approved, the record moves on to coding.',
    value: 'Unreadable records are caught before they are needed in court or for a claim.',
    steps: [
      { role: 'qc', page: 'qc', params: { ip: 'IP/26/10394', type: 'OP' }, text: 'Open Kiran Patil’s Operative Notes. Mark pages 1 & 3 Clear, page 2 “Unclear”, enter a remark and Reject.', done: (s) => doc(s, 'IP/26/10394', 'OP')?.status === 'QC Rejected' || (doc(s, 'IP/26/10394', 'OP')?.version || 1) > 1 },
      { role: 'scanning', page: 'scanning', params: { ip: 'IP/26/10394', tab: 'rework' }, text: 'In the Rework tab, open the document, “Rescan page” on page 2, then “Resubmit to QC”.', done: (s) => (doc(s, 'IP/26/10394', 'OP')?.version || 1) > 1 },
      { role: 'qc', page: 'qc', params: { ip: 'IP/26/10394', type: 'OP' }, text: 'Review again — all pages are now clear. Mark them Clear and Approve.', done: (s) => doc(s, 'IP/26/10394', 'OP')?.status === 'Approved' },
      { role: 'qc', page: 'patient', params: { ip: 'IP/26/10394', tab: 'docs' }, text: 'Kiran’s record is now ready for coding; QC history is visible on the document.' },
    ],
  },
  {
    id: 's5', n: 5, title: 'Completeness & ICD coding', patient: 'Mohan Verma', icon: 'FileCheck2',
    story: 'Mohan Verma’s file has cleared QC, but the general consent form was never found. MRD must flag the deficiency to the responsible doctor, verify the response, code the diagnoses and close the record.',
    actor: 'Meera Iyer — MRD executive & coder', action: 'Raise a deficiency for General Consent, simulate the doctor’s response, verify it, add ICD-10 codes, mark complete and close.',
    expected: 'Record status goes Pending Review → Incomplete → Complete → Closed; the file is queued for storage.',
    value: 'No record is closed with missing consents — a key NABH medical-record audit finding.',
    steps: [
      { role: 'executive', page: 'coding', params: { ip: 'IP/26/10329' }, text: 'In the checklist, General Consent is missing. Click “Raise deficiency”, assign it to Dr. Arvind Menon and save.', done: (s) => s.deficiencies.some((d) => d.ip === 'IP/26/10329' && d.type === 'GC') },
      { role: 'executive', page: 'coding', params: { ip: 'IP/26/10329' }, text: 'Click “Simulate response” (the doctor supplies the signed form), then “Verify & resolve”.', done: (s) => s.deficiencies.some((d) => d.ip === 'IP/26/10329' && d.type === 'GC' && d.status === 'Resolved') },
      { role: 'executive', page: 'coding', params: { ip: 'IP/26/10329' }, text: 'Add codes (try the demo suggestions E11.1 and I10), then “Complete coding”.', done: (s) => enc(s, 'IP/26/10329')?.coding.status === 'Coded' },
      { role: 'executive', page: 'coding', params: { ip: 'IP/26/10329' }, text: 'Click “Mark complete”, then “Close record”.', done: (s) => enc(s, 'IP/26/10329')?.record.status === 'Closed' },
    ],
  },
  {
    id: 's6', n: 6, title: 'Storage & retrieval', patient: 'Deepa Nair', icon: 'Archive',
    story: 'Deepa Nair’s closed file is sitting at the processing bay. It needs a permanent shelf position so that anyone can find it months later.',
    actor: 'Meera Iyer (MRD) → Dr. Vikram Rao (Department) → Meera Iyer', action: 'Assign a rack/shelf position, then raise a request for the file and see how MRD locates it.',
    expected: 'The file shows a location trail (Room › Rack › Shelf › Position); the request desk shows exactly where to pick it from.',
    value: 'Retrieval in minutes instead of hunting through racks — and no file is “available” when it is actually out.',
    steps: [
      { role: 'executive', page: 'storage', params: { file: 'PF-10301-V1' }, text: 'Deepa Nair’s file is in “Awaiting storage”. Select it, accept the suggested free position (or click one on the rack map) and press “Store here”.', done: (s) => !!s.files.find((f) => f.id === 'PF-10301-V1')?.location },
      { role: 'requester', page: 'myrequests', params: { newFor: 'IP/26/10301' }, text: 'As Dr. Vikram Rao, request Deepa Nair’s complete physical file (enter a purpose and submit).', done: (s) => !!reqFor(s, 'IP/26/10301') },
      { role: 'executive', page: 'desk', params: { ip: 'IP/26/10301' }, text: 'At the Request Desk, open the request — the location trail tells you where to pick the file. Issue it.', done: (s) => ['Issued', 'Accepted'].includes(reqFor(s, 'IP/26/10301')?.status) },
    ],
  },
  {
    id: 's7', n: 7, title: 'Department file request', patient: 'Ramesh Agarwal', icon: 'Send',
    story: 'Dr. Vikram Rao needs Ramesh Agarwal’s previous CABG admission file for today’s follow-up clinic.',
    actor: 'Dr. Vikram Rao → Meera Iyer → Dr. Vikram Rao', action: 'Request the complete file, issue it from MRD, and accept receipt in the department.',
    expected: 'Request gets a reference and TAT, file status becomes Issued with custodian and return date, and acceptance is recorded.',
    value: 'Every movement of a physical file is accountable, with a configured turnaround time.',
    steps: [
      { role: 'requester', page: 'myrequests', params: { newFor: 'IP/26/06120' }, text: 'Choose “Complete file”, Physical, a purpose and urgency, then submit.', done: (s) => !!reqFor(s, 'IP/26/06120') },
      { role: 'executive', page: 'desk', params: { ip: 'IP/26/06120' }, text: 'Open the new request and click “Issue file”. Confirm receiver and return period.', done: (s) => ['Issued', 'Accepted'].includes(reqFor(s, 'IP/26/06120')?.status) },
      { role: 'requester', page: 'myrequests', params: { ip: 'IP/26/06120' }, text: 'Back in Cardiology, click “Accept receipt”.', done: (s) => reqFor(s, 'IP/26/06120')?.status === 'Accepted' },
    ],
  },
  {
    id: 's8', n: 8, title: 'Missing / damaged file escalation', patient: 'Sushila Pandey', icon: 'FileWarning',
    story: 'Sushila Pandey’s file arrived at Cardiology OPD, but the consent pages appear to be missing.',
    actor: 'Dr. Vikram Rao → Dr. Sunita Deshpande (MRD Supervisor)', action: 'Report the discrepancy on receipt; then, as supervisor, review and resolve the escalation.',
    expected: 'An escalation is raised with reason and responsible user; resolution notes close it and update the request.',
    value: 'Missing documents are surfaced immediately and owned by a senior person — not discovered during an audit.',
    steps: [
      { role: 'requester', page: 'myrequests', params: { req: 'RQ-26-0311' }, text: 'Open the issued request for Sushila Pandey and click “Report discrepancy”. Choose “Missing documents” and describe it.', done: (s) => !!req(s, 'RQ-26-0311')?.discrepancy },
      { role: 'supervisor', page: 'escalations', params: { ref: 'RQ-26-0311' }, text: 'As supervisor, open the discrepancy escalation, acknowledge it, then resolve with notes.', done: (s) => req(s, 'RQ-26-0311')?.discrepancy?.status === 'Resolved' },
    ],
  },
  {
    id: 's9', n: 9, title: 'TAT breach & escalation', patient: 'Vinod Chavan', icon: 'Siren',
    story: 'An urgent request for Vinod Chavan’s file (4-hour TAT) is still unfulfilled. Watch it breach and escalate automatically.',
    actor: 'System (TAT rules) → MRD Supervisor', action: 'Use the demo clock to move time forward by 1–2 hours; then check the escalation queue.',
    expected: 'The request turns Overdue, an escalation is created by the TAT rule, and it auto-closes once MRD issues the file.',
    value: 'Supervisors see breaches as they happen — no one has to remember to chase.',
    steps: [
      { role: 'supervisor', page: 'escalations', params: {}, text: 'Click “+1 h” on the demo clock in the header twice (or until the request for RQ-26-0312 breaches).', done: (s) => s.escalations.some((x) => x.key === 'RQ:RQ-26-0312') },
      { role: 'supervisor', page: 'escalations', params: { ref: 'RQ-26-0312' }, text: 'The breach is now in the escalation queue with level, responsible user and overdue time. Acknowledge it.', done: (s) => s.escalations.some((x) => x.key === 'RQ:RQ-26-0312' && x.status !== 'Open') },
      { role: 'executive', page: 'desk', params: { ip: 'IP/26/05201' }, text: 'Fulfil it: issue Vinod Chavan’s file. The escalation closes automatically.', done: (s) => ['Issued', 'Accepted'].includes(req(s, 'RQ-26-0312')?.status) },
    ],
  },
  {
    id: 's10', n: 10, title: 'Return & closure', patient: 'Arjun Malhotra', icon: 'PackageCheck',
    story: 'Cardiology has finished with Arjun Malhotra’s file and sends it back. MRD inspects it and returns it to the exact shelf position.',
    actor: 'Dr. Vikram Rao → Meera Iyer', action: 'Return the file from the department; inspect and restore it at the MRD Request Desk.',
    expected: 'Request closes, file becomes Available at its recorded location, and the loan is in the audit trail.',
    value: 'Closes the loop — files come back complete and go back to the right place.',
    steps: [
      { role: 'requester', page: 'myrequests', params: { req: 'RQ-26-0313' }, text: 'Open Arjun Malhotra’s request and click “Return file”.', done: (s) => ['Return Submitted', 'Closed'].includes(req(s, 'RQ-26-0313')?.status) },
      { role: 'executive', page: 'desk', params: { tab: 'returns', ip: 'IP/26/08012' }, text: 'In Returns, open it, tick the inspection checks and click “Accept & restore”.', done: (s) => req(s, 'RQ-26-0313')?.status === 'Closed' },
      { role: 'executive', page: 'storage', params: { file: 'PF-08012-V1' }, text: 'The file is back at Room A › Rack 2 › Shelf 1 › Pos 7 and Available.' },
    ],
  },
  {
    id: 's11', n: 11, title: 'Upload & map an outside document', patient: "Joseph D'Souza", icon: 'Upload',
    story: "Joseph D'Souza’s family has brought an MRI report from an outside diagnostic centre. It arrives as a file, not as part of the ward handover, and must be tagged and mapped to the right admission.",
    actor: 'Pooja Shinde — Scanning operator', action: 'Upload the file, tag it as a Radiology Report from outside the hospital, find and confirm the patient, then submit.',
    expected: 'The outside report joins Joseph’s record under Investigation, flagged “Outside hospital”, with uploader and time in the audit trail.',
    value: 'Outside and legacy papers enter through one controlled route — format, size, duplicate and patient checks — instead of being stapled into files.',
    steps: [
      { role: 'scanning', page: 'intake', params: { loose: 1 }, text: 'A loose-document batch is open. Choose “Upload files”, click “Use sample outside report” and “Add to batch”.', done: (s) => (looseFor(s)?.pages.length || 0) > 0 },
      { role: 'scanning', page: 'intake', params: { batch: '__loose' }, text: 'Step 2: select the page, set type “Radiology Report”, add the tag “Outside hospital” and press “Tag pages as document”.', done: (s) => { const b = looseFor(s); return !!b && b.docs.length > 0 && b.pages.every((pg) => pg.discarded || b.docs.some((d) => d.pageIds.includes(pg.id))) } },
      { role: 'scanning', page: 'intake', params: { batch: '__loose' }, text: "Step 3: search “Joseph”, pick admission IP/26/10358, tick the confirmation and “Map to patient file”.", done: (s) => looseFor(s)?.mapped && looseFor(s)?.ip === 'IP/26/10358' },
      { role: 'scanning', page: 'intake', params: { batch: '__loose' }, text: 'Step 4: “Submit to QC”. Then open Patient 360° to see the document under Investigation.', done: (s) => looseFor(s)?.status === 'Submitted' },
    ],
  },
]
