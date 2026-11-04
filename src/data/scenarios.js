// Guided demo scenarios.
// Every step can be performed by the user, or played automatically: `auto(run, get)` calls the SAME store
// actions the screens use, so the demo and the product can never drift apart.
// `ready(s)` checks the scenario's patient is still in its starting state, so a restart never duplicates data.
import { WF, checklistTypes, docType } from './catalog'
import { freeSlot } from '../lib/logic'

const enc = (s, ip) => s.encounters.find((e) => e.ip === ip)
const st = (s, ip) => enc(s, ip)?.status
const req = (s, id) => s.requests.find((r) => r.id === id)
const reqFor = (s, ip, by = 'Dr. Vikram Rao') => s.requests.filter((r) => r.ip === ip && r.requester === by).sort((a, b) => b.createdAt - a.createdAt)[0]
const defFor = (s, ip, type) => s.deficiencies.filter((d) => d.ip === ip && d.docType === type).sort((a, b) => b.raisedAt - a.raisedAt)[0]
const batchFor = (s, ip) => s.batches.filter((b) => b.ip === ip).sort((a, b) => b.createdAt - a.createdAt)[0]
const looseFor = (s) => s.batches.filter((b) => b.source !== 'Physical file').sort((a, b) => b.createdAt - a.createdAt)[0]
const scanDoc = (s, ip, type) => s.documents.find((d) => d.ip === ip && d.type === type && d.kind === 'scanned')
const after = (s, ip, statuses) => statuses.includes(st(s, ip))

const ROHAN = 'IP/26/10421'
const LAKSHMI = 'IP/26/10402'
const PRIYA = 'IP/26/10411'
const JOSEPH = 'IP/26/10358'
const KIRAN = 'IP/26/10394'
const POST_RECEIPT = [WF.AWAIT_REVIEW, WF.CORRECTIONS, WF.AWAIT_VERIFY, WF.READY, WF.ARCHIVED]

// helper: send a complete handover exactly as the Nurse Handover screen does
const sendAll = (run, get, ip, extra = {}) => {
  const e = enc(get(), ip)
  const items = checklistTypes(e).filter((t) => docType(t).src === 'Physical').map((t) => ({ type: t, pages: docType(t).pages || 1 }))
  const electronic = get().documents.filter((d) => d.ip === ip && d.kind === 'electronic').map((d) => d.id)
  return run('SUBMIT_HANDOVER', { ip, items, electronic, carrier: 'Ward attendant – Suresh More', remarks: '', ...extra }, 'Handover sent to MRD')
}

export const SCENARIOS = [
  {
    id: 'e2e', n: 1, featured: true, roles: ['nurse', 'receiving', 'qc', 'requester', 'executive', 'supervisor'], icon: 'Workflow',
    title: 'End-to-end: discharge to archive', patient: 'Rohan Kulkarni',
    story: 'Rohan Kulkarni was discharged from the Cardiac ward after an angioplasty. His file travels from the ward to MRD, is reviewed, has two problems corrected (one correction is rejected the first time), and is finally accepted and archived.',
    actor: 'Ward nurse → MRD receiving → MRD reviewer → Doctor & nurse → MRD records officer',
    action: 'Send the file, receive it, review & scan it, raise deficiencies, correct them, verify, accept, then view the full lifecycle.',
    expected: 'Every status change, owner, remark and time is captured automatically; worklists and dashboards update at each step.',
    value: 'Replaces the ward handover register, MRD inward register, deficiency chits, phone follow-ups and the Excel tracker with one connected record.',
    ready: (s) => st(s, ROHAN) === WF.NOT_SENT,
    steps: [
      { role: 'nurse', page: 'handover', params: { ip: ROHAN, tab: 'notsent' }, title: 'Nurse prepares & sends the file',
        text: 'Sr. Anjali Pawar opens Rohan Kulkarni in Records Not Sent. The checklist shows paper documents to tick and the electronic documents already received from HMIS. She sends it to MRD.',
        done: (s) => after(s, ROHAN, [WF.AWAIT_RECEIPT, ...POST_RECEIPT]), auto: (run, get) => sendAll(run, get, ROHAN) },
      { role: 'receiving', page: 'receiving', params: { ip: ROHAN, open: 'receive', tab: 'receipt' }, title: 'MRD acknowledges receipt',
        text: 'At the MRD counter, Ramesh Kadam confirms identity, counts the documents and acknowledges receipt. Custody moves to MRD; the record joins Awaiting Review.',
        done: (s) => after(s, ROHAN, POST_RECEIPT),
        auto: (run, get) => run('RECEIVE_HANDOVER', { ip: ROHAN, identity: true, received: enc(get(), ROHAN).handover.items.map((i) => i.type), condition: 'Good', remarks: '' }, 'Receipt acknowledged') },
      { role: 'qc', page: 'receiving', params: { ip: ROHAN, open: 'review', tab: 'review' }, title: 'Reviewer scans & checks the pages',
        text: 'Farhan Shaikh (MRD reviewer) scans the paper documents from the review checklist and verifies each scan. Digital availability is tracked separately from the paper file.',
        done: (s) => !s.documents.some((d) => d.ip === ROHAN && ['Awaiting Scan', 'QC Pending', 'QC Rejected'].includes(d.status)),
        auto: (run, get) => {
          get().documents.filter((d) => d.ip === ROHAN && d.status === 'Awaiting Scan').forEach((d) => run('SCAN_ITEM', { ip: ROHAN, type: d.type, context: 'MRD review' }))
          get().documents.filter((d) => d.ip === ROHAN && d.status === 'QC Pending').forEach((d) => run('VERIFY_SCAN', { id: d.id, ok: true }))
          run('NAV', { page: 'receiving', params: { ip: ROHAN, open: 'review', tab: 'review' } }, 'All paper documents scanned and verified')
        } },
      { role: 'qc', page: 'receiving', params: { ip: ROHAN, open: 'review', tab: 'review' }, title: 'Reviewer raises deficiencies',
        text: 'Two problems are found: the procedure consent is not signed by the doctor, and the nursing notes are missing the 19 Oct night-shift entry. Each becomes a deficiency with its own owner and due time; the rest is marked OK and the review is completed.',
        done: (s) => after(s, ROHAN, [WF.CORRECTIONS, WF.AWAIT_VERIFY, WF.READY, WF.ARCHIVED]),
        auto: (run, get) => {
          if (!defFor(get(), ROHAN, 'SC')) run('RAISE_DEF', { ip: ROHAN, category: 'signature', docType: 'SC', title: 'Procedure consent not signed by doctor', description: 'Consent for PTCA (17 Oct) has the patient’s and witness signatures but no doctor signature.', assignee: { kind: 'user', name: 'Dr. Vikram Rao' } })
          if (!defFor(get(), ROHAN, 'NN')) run('RAISE_DEF', { ip: ROHAN, category: 'incomplete', docType: 'NN', title: 'Nursing notes incomplete', description: 'No nursing entry for the 19 Oct night shift (20:00–08:00).', assignee: { kind: 'ward', ward: 'Ward 7B Cardiac' } })
          const e = enc(get(), ROHAN)
          run('REVIEW_ITEM', { ip: ROHAN, types: checklistTypes(e).filter((t) => !e.review?.items?.[t]), verdict: 'ok' })
          run('COMPLETE_REVIEW', { ip: ROHAN }, 'Review completed – corrections required')
        } },
      { role: 'requester', page: 'deficiencies', params: (s) => ({ def: defFor(s, ROHAN, 'SC')?.id, tab: 'mine' }), title: 'Doctor signs the consent',
        text: 'Dr. Vikram Rao sees the deficiency in “Assigned to me”, signs the consent electronically (simulated) and submits the correction.',
        done: (s) => (defFor(s, ROHAN, 'SC')?.corrections.length || 0) > 0,
        auto: (run, get) => run('SUBMIT_CORRECTION', { id: defFor(get(), ROHAN, 'SC').id, note: 'Consent signed electronically by Dr. Vikram Rao' }, 'Correction submitted') },
      { role: 'nurse', page: 'deficiencies', params: (s) => ({ def: defFor(s, ROHAN, 'NN')?.id, tab: 'mine' }), title: 'Nurse adds the missing entry',
        text: 'Sr. Anjali Pawar adds the missing night-shift entry as a late entry and attaches a scan of the corrected page.',
        done: (s) => (defFor(s, ROHAN, 'NN')?.corrections.length || 0) > 0,
        auto: (run, get) => run('SUBMIT_CORRECTION', { id: defFor(get(), ROHAN, 'NN').id, note: 'Late entry added for 19 Oct night shift', attach: 'scan' }, 'Correction submitted') },
      { role: 'qc', page: 'deficiencies', params: { tab: 'verify', ip: ROHAN }, title: 'MRD verifies — one correction rejected',
        text: 'The consent signature is accepted. The nursing-notes correction is rejected: the late entry is not countersigned by the nurse-in-charge. It reopens with a new due time and goes back to the ward.',
        done: (s) => defFor(s, ROHAN, 'SC')?.status === 'Verified' && (defFor(s, ROHAN, 'NN')?.reopened || 0) > 0,
        auto: (run, get) => {
          if (defFor(get(), ROHAN, 'SC').status === 'Correction Submitted') run('VERIFY_DEF', { id: defFor(get(), ROHAN, 'SC').id, ok: true })
          if (defFor(get(), ROHAN, 'NN').status === 'Correction Submitted') run('VERIFY_DEF', { id: defFor(get(), ROHAN, 'NN').id, ok: false, remarks: 'Late entry is not countersigned by the nurse-in-charge. Please countersign and resubmit.' }, 'Correction rejected – sent back to the ward')
        } },
      { role: 'nurse', page: 'deficiencies', params: (s) => ({ def: defFor(s, ROHAN, 'NN')?.id, tab: 'mine' }), title: 'Nurse resubmits',
        text: 'The ward sees the rejection reason, gets the nurse-in-charge countersignature and resubmits.',
        done: (s) => (defFor(s, ROHAN, 'NN')?.corrections.length || 0) > 1,
        auto: (run, get) => run('SUBMIT_CORRECTION', { id: defFor(get(), ROHAN, 'NN').id, note: 'Countersigned by nurse-in-charge Sr. Leena Patil; page rescanned', attach: 'scan' }, 'Correction resubmitted') },
      { role: 'qc', page: 'deficiencies', params: (s) => ({ def: defFor(s, ROHAN, 'NN')?.id, tab: 'verify' }), title: 'MRD verifies the resubmission',
        text: 'The reviewer accepts the corrected nursing notes. With no open deficiencies left, the record moves to Ready for Acceptance automatically.',
        done: (s) => after(s, ROHAN, [WF.READY, WF.ARCHIVED]),
        auto: (run, get) => run('VERIFY_DEF', { id: defFor(get(), ROHAN, 'NN').id, ok: true }, 'Correction verified – record ready for acceptance') },
      { role: 'executive', page: 'receiving', params: { ip: ROHAN, open: 'accept', tab: 'ready' }, title: 'Final acceptance & archival',
        text: 'Meera Iyer checks the acceptance summary, takes the suggested archive position and accepts the record. The file is now Available in the archive.',
        done: (s) => st(s, ROHAN) === WF.ARCHIVED,
        auto: (run, get) => run('ACCEPT_RECORD', { ip: ROHAN, loc: freeSlot(get(), 'A') }, 'Record accepted & archived') },
      { role: 'executive', page: 'tracking', params: { ip: ROHAN }, title: 'Complete lifecycle',
        text: 'Record Tracking shows the whole journey: progress tracker, file location, digital copy, both deficiencies with their own histories (including the rejected correction), and every status change with user, time and remarks.' },
    ],
  },
  {
    id: 'return', n: 2, roles: ['receiving', 'nurse'], icon: 'Undo2',
    title: 'Incomplete file returned to ward', patient: 'Lakshmi Narayanan',
    story: 'Lakshmi Narayanan’s file reaches the MRD counter without the operative notes. Instead of a phone call, MRD returns it with a reason; the ward fixes it and resends.',
    actor: 'MRD receiving → Ward nurse → MRD receiving', action: 'Return the file with a reason, fix & resend it, then acknowledge the new version.',
    expected: 'The return reason appears at the top of the ward’s Records Not Sent list; the resend creates handover version 2 with both versions kept.',
    value: 'Disputes about incomplete files are recorded once, with who/when/why, instead of in registers and calls.',
    ready: (s) => st(s, LAKSHMI) === WF.AWAIT_RECEIPT && !(enc(s, LAKSHMI).handovers || []).length,
    steps: [
      { role: 'receiving', page: 'receiving', params: { ip: LAKSHMI, open: 'receive', tab: 'receipt' }, title: 'Return the file',
        text: 'The operative notes are not in the file. Ramesh uses “Return to ward”, chooses “Incomplete file” and explains.',
        done: (s) => st(s, LAKSHMI) === WF.RETURNED || (enc(s, LAKSHMI).handovers || []).length > 0,
        auto: (run) => run('RETURN_HANDOVER', { ip: LAKSHMI, category: 'Incomplete file', reason: 'Operative / procedure notes for AV fistula creation not in the file.' }, 'File returned to ward') },
      { role: 'nurse', page: 'handover', params: { ip: LAKSHMI, tab: 'notsent' }, title: 'Ward fixes & resends',
        text: 'Sr. Anjali sees the return reason, finds the notes, ticks them and resends. A new handover version is created.',
        done: (s) => (enc(s, LAKSHMI).handovers || []).length > 0 && st(s, LAKSHMI) !== WF.RETURNED,
        auto: (run, get) => sendAll(run, get, LAKSHMI, { remarks: 'Operative notes traced in dialysis unit and added.' }) },
      { role: 'receiving', page: 'receiving', params: { ip: LAKSHMI, open: 'receive', tab: 'receipt' }, title: 'Acknowledge version 2',
        text: 'MRD receives the complete file.', done: (s) => after(s, LAKSHMI, POST_RECEIPT),
        auto: (run, get) => run('RECEIVE_HANDOVER', { ip: LAKSHMI, identity: true, received: enc(get(), LAKSHMI).handover.items.map((i) => i.type), condition: 'Good' }, 'Receipt acknowledged') },
      { role: 'receiving', page: 'tracking', params: { ip: LAKSHMI }, title: 'See both versions',
        text: 'The tracker shows “returned ×1”; the Handovers tab keeps version 1 (returned) and version 2 (received).' },
    ],
  },
  {
    id: 'intake', n: 3, roles: ['scanning', 'receiving'], icon: 'FileScan',
    title: 'Bulk intake: scan, tag & map a file', patient: 'Priya Deshmukh',
    story: 'Priya Deshmukh’s maternity file has been received. The operator scans it in one batch, splits the pages into documents, tags each, and maps the batch to her admission.',
    actor: 'Scanning operator', action: 'Capture → tag → map → submit to scan check.',
    expected: 'Each document is filed under her UHID, admission and physical file, reconciled against the ward’s handover list.',
    value: 'No loose scans: every page is tied to a document type, a patient and its paper source.',
    ready: (s) => s.documents.some((d) => d.ip === PRIYA && d.status === 'Awaiting Scan') && !s.batches.some((b) => b.ip === PRIYA && b.status === 'Submitted'),
    steps: [
      { role: 'scanning', page: 'intake', params: { ip: PRIYA }, title: 'Capture', text: 'Scan the whole file (17 pages expected).',
        done: (s) => (batchFor(s, PRIYA)?.pages.length || 0) > 0,
        auto: (run, get) => { const r = run('INTAKE_NEW', { ip: PRIYA }); run('INTAKE_CAPTURE', { id: r.state.lastRef, method: 'scan' }, 'File scanned as one batch'); run('NAV', { page: 'intake', params: { batch: r.state.lastRef } }) } },
      { role: 'scanning', page: 'intake', params: (s) => ({ batch: batchFor(s, PRIYA)?.id }), title: 'Tag documents', text: 'Each expected document is a one-click chip that selects its pages; tag type, folder and date.',
        done: (s) => { const b = batchFor(s, PRIYA); return !!b && b.docs.length > 0 && b.pages.every((pg) => pg.discarded || b.docs.some((d) => d.pageIds.includes(pg.id))) },
        auto: (run, get) => {
          const b = batchFor(get(), PRIYA)
          const phs = get().documents.filter((d) => d.ip === PRIYA && d.status === 'Awaiting Scan')
          let k = 0
          phs.forEach((d) => { const ids = b.pages.slice(k, k + (d.expectedPages || 1)).map((p) => p.id); k += ids.length; if (ids.length) run('INTAKE_TAG', { id: b.id, pageIds: ids, type: d.type, folder: docType(d.type).folder, tags: ['Original'], docDate: enc(get(), PRIYA).discharged, placeholderId: d.id }) })
          run('NAV', { page: 'intake', params: { batch: b.id } }, 'All pages tagged')
        } },
      { role: 'scanning', page: 'intake', params: (s) => ({ batch: batchFor(s, PRIYA)?.id }), title: 'Map to patient file', text: 'Confirm the batch belongs to Priya’s admission and file.',
        done: (s) => !!batchFor(s, PRIYA)?.mapped, auto: (run, get) => run('INTAKE_MAP', { id: batchFor(get(), PRIYA).id, ip: PRIYA, confirmed: true }, 'Mapped to patient file') },
      { role: 'scanning', page: 'intake', params: (s) => ({ batch: batchFor(s, PRIYA)?.id }), title: 'Submit', text: 'Submit for scan check. The documents now count towards her digital copy once checked.',
        done: (s) => batchFor(s, PRIYA)?.status === 'Submitted', auto: (run, get) => run('INTAKE_SUBMIT', { id: batchFor(get(), PRIYA).id }, 'Submitted for scan check') },
    ],
  },
  {
    id: 'upload', n: 4, roles: ['scanning'], icon: 'Upload',
    title: 'Upload & map an outside report', patient: "Joseph D'Souza",
    story: 'The family brings an MRI report from an outside centre. It must be tagged and mapped to the right admission through one controlled route.',
    actor: 'Scanning operator', action: 'Upload, tag as Radiology Report / Outside hospital, map to the admission, submit.',
    expected: 'The report joins Joseph’s record under Investigation with uploader and time in the history.',
    value: 'Outside and legacy papers stop being stapled into files with no trace.',
    ready: (s) => !s.documents.some((d) => d.ip === JOSEPH && (d.fingerprint || '').includes('Outside_MRI_Brain_Report')),
    steps: [
      { role: 'scanning', page: 'intake', params: { loose: 1 }, title: 'Upload', text: 'Choose Upload files and use the sample outside report.',
        done: (s) => (looseFor(s)?.pages.length || 0) > 0 && looseFor(s)?.status === 'Draft' || looseFor(s)?.status === 'Submitted',
        auto: (run) => { const r = run('INTAKE_NEW', {}); run('INTAKE_CAPTURE', { id: r.state.lastRef, method: 'upload', uploads: [{ name: 'Outside_MRI_Brain_Report_Lilavati_Diagnostics.pdf', size: 612344 }] }, 'File uploaded'); run('NAV', { page: 'intake', params: { batch: r.state.lastRef } }) } },
      { role: 'scanning', page: 'intake', params: { batch: '__loose' }, title: 'Tag', text: 'Tag the page as Radiology Report with the tag “Outside hospital”.',
        done: (s) => (looseFor(s)?.docs.length || 0) > 0,
        auto: (run, get) => { const b = looseFor(get()); run('INTAKE_TAG', { id: b.id, pageIds: b.pages.map((p) => p.id), type: 'RAD', folder: 'Investigation', tags: ['Outside hospital'], docDate: get().now - 72 * 3600000 }, 'Tagged as Radiology Report') } },
      { role: 'scanning', page: 'intake', params: { batch: '__loose' }, title: 'Map', text: "Search “Joseph”, pick admission IP/26/10358 and confirm.",
        done: (s) => looseFor(s)?.mapped && looseFor(s)?.ip === JOSEPH, auto: (run, get) => run('INTAKE_MAP', { id: looseFor(get()).id, ip: JOSEPH, confirmed: true }, 'Mapped to patient file') },
      { role: 'scanning', page: 'intake', params: { batch: '__loose' }, title: 'Submit', text: 'Submit; the report appears in his record.',
        done: (s) => looseFor(s)?.status === 'Submitted', auto: (run, get) => run('INTAKE_SUBMIT', { id: looseFor(get()).id }, 'Submitted') },
    ],
  },
  {
    id: 'scanqc', n: 5, roles: ['qc', 'scanning'], icon: 'ShieldCheck',
    title: 'Unreadable scan caught & rescanned', patient: 'Kiran Patil',
    story: 'Page 2 of Kiran Patil’s operative notes was scanned out of focus. The check catches it, scanning fixes it, and it is approved.',
    actor: 'MRD reviewer → Scanning operator → MRD reviewer', action: 'Reject with a page mark, rescan the page, approve.',
    expected: 'Rework history (who, when, why) is kept on the document.', value: 'Unreadable records are caught before they are needed in court or for a claim.',
    ready: (s) => scanDoc(s, KIRAN, 'OP')?.status === 'QC Pending' && scanDoc(s, KIRAN, 'OP')?.version === 1,
    steps: [
      { role: 'qc', page: 'qc', params: { ip: KIRAN, type: 'OP' }, title: 'Reject the page', text: 'Mark page 2 “Unclear”, add a remark and reject.',
        done: (s) => scanDoc(s, KIRAN, 'OP')?.status === 'QC Rejected' || (scanDoc(s, KIRAN, 'OP')?.version || 1) > 1,
        auto: (run, get) => run('QC_DECIDE', { id: scanDoc(get(), KIRAN, 'OP').id, decision: 'Rejected', marks: { 1: 'Clear', 2: 'Unclear', 3: 'Clear' }, remarks: 'Page 2 out of focus – please rescan' }, 'Sent back for rescan') },
      { role: 'scanning', page: 'scanning', params: { ip: KIRAN, tab: 'rework' }, title: 'Rescan', text: 'Rescan page 2 and resubmit.',
        done: (s) => (scanDoc(s, KIRAN, 'OP')?.version || 1) > 1,
        auto: (run, get) => { const d = scanDoc(get(), KIRAN, 'OP'); run('PAGE_FIX', { id: d.id, n: 2, action: 'replace' }); run('RESUBMIT', { id: d.id }, 'Rescanned and resubmitted') } },
      { role: 'qc', page: 'qc', params: { ip: KIRAN, type: 'OP' }, title: 'Approve', text: 'All pages are now clear — approve.',
        done: (s) => scanDoc(s, KIRAN, 'OP')?.status === 'Approved',
        auto: (run, get) => run('QC_DECIDE', { id: scanDoc(get(), KIRAN, 'OP').id, decision: 'Approved', marks: { 1: 'Clear', 2: 'Clear', 3: 'Clear' } }, 'Scan approved') },
    ],
  },
  {
    id: 'request', n: 6, roles: ['requester', 'executive'], icon: 'Send',
    title: 'Department requests an archived file', patient: 'Ramesh Agarwal',
    story: 'Dr. Vikram Rao needs Ramesh Agarwal’s previous CABG admission file for today’s clinic.',
    actor: 'Doctor → Records officer → Doctor', action: 'Request, issue (location shown), accept receipt.',
    expected: 'Custodian and return date recorded; the archive map shows the file as issued.', value: 'Every movement of a physical file is accountable.',
    ready: (s) => !reqFor(s, 'IP/26/06120') && s.files.find((f) => f.ip === 'IP/26/06120')?.status === 'Available',
    steps: [
      { role: 'requester', page: 'myrequests', params: { newFor: 'IP/26/06120' }, title: 'Request', text: 'Request the complete physical file.',
        done: (s) => !!reqFor(s, 'IP/26/06120'),
        auto: (run) => run('CREATE_REQ', { ip: 'IP/26/06120', scope: 'Complete file', mode: 'Physical', docIds: [], purpose: 'Follow-up OPD review', urgency: 'Routine' }, 'Request submitted') },
      { role: 'executive', page: 'desk', params: { ip: 'IP/26/06120' }, title: 'Issue', text: 'The request shows exactly where the file is; issue it.',
        done: (s) => ['Issued', 'Accepted'].includes(reqFor(s, 'IP/26/06120')?.status),
        auto: (run, get) => run('REQ_ACTION', { id: reqFor(get(), 'IP/26/06120').id, action: 'issue', to: 'Dr. Vikram Rao', hours: 48 }, 'File issued') },
      { role: 'requester', page: 'myrequests', params: { ip: 'IP/26/06120' }, title: 'Accept receipt', text: 'Confirm the file arrived.',
        done: (s) => reqFor(s, 'IP/26/06120')?.status === 'Accepted',
        auto: (run, get) => run('REQ_ACTION', { id: reqFor(get(), 'IP/26/06120').id, action: 'accept', note: 'Received complete' }, 'Receipt accepted') },
    ],
  },
  {
    id: 'discrepancy', n: 7, roles: ['requester', 'supervisor'], icon: 'FileWarning',
    title: 'Missing pages reported & resolved', patient: 'Sushila Pandey',
    story: 'An issued file arrives at Cardiology OPD without its consent pages.', actor: 'Doctor → MRD supervisor',
    action: 'Report the discrepancy; the supervisor acknowledges and resolves it.', expected: 'Escalation with owner and resolution notes.', value: 'Missing documents are owned by a senior person immediately.',
    ready: (s) => req(s, 'RQ-26-0311')?.status === 'Issued',
    steps: [
      { role: 'requester', page: 'myrequests', params: { req: 'RQ-26-0311' }, title: 'Report', text: 'Report “Missing documents” on receipt.',
        done: (s) => !!req(s, 'RQ-26-0311')?.discrepancy,
        auto: (run) => run('REQ_ACTION', { id: 'RQ-26-0311', action: 'discrepancy', kind: 'Missing documents', remarks: 'Consent pages for angiography are not in the file' }, 'Discrepancy reported & escalated') },
      { role: 'supervisor', page: 'escalations', params: { ref: 'RQ-26-0311' }, title: 'Resolve', text: 'Acknowledge and resolve with notes.',
        done: (s) => req(s, 'RQ-26-0311')?.discrepancy?.status === 'Resolved',
        auto: (run, get) => { const x = get().escalations.find((y) => y.ref === 'RQ-26-0311' && y.status !== 'Resolved'); run('ESC_ACTION', { id: x.id, action: 'ack', owner: 'Meera Iyer (MRD Records Officer)' }); run('ESC_ACTION', { id: x.id, action: 'resolve', note: 'Consent pages found in cath lab register and re-filed; requester informed.' }, 'Escalation resolved') } },
    ],
  },
  {
    id: 'tat', n: 8, roles: ['supervisor', 'executive'], icon: 'Siren',
    title: 'TAT breach escalates automatically', patient: 'Vinod Chavan',
    story: 'An urgent file request (4-hour TAT) is still unfulfilled. Move the clock and watch it breach.', actor: 'System → Supervisor → Records officer',
    action: 'Advance the clock, acknowledge the escalation, fulfil the request.', expected: 'The escalation is raised by the TAT rule and closes itself when the file is issued.', value: 'Breaches are seen as they happen — no chasing.',
    ready: (s) => req(s, 'RQ-26-0312')?.status === 'Pending',
    steps: [
      { role: 'supervisor', page: 'escalations', params: {}, title: 'Clock moves on', text: 'Two hours pass (+1 h twice on the demo clock).',
        done: (s) => s.escalations.some((x) => x.key === 'RQ:RQ-26-0312'),
        auto: (run) => { run('CLOCK', { hours: 1 }); run('CLOCK', { hours: 1 }, 'Demo clock +2 h – request breached its TAT') } },
      { role: 'supervisor', page: 'escalations', params: { ref: 'RQ-26-0312' }, title: 'Acknowledge', text: 'Acknowledge and assign an owner.',
        done: (s) => s.escalations.some((x) => x.key === 'RQ:RQ-26-0312' && x.status !== 'Open'),
        auto: (run, get) => run('ESC_ACTION', { id: get().escalations.find((x) => x.key === 'RQ:RQ-26-0312').id, action: 'ack', owner: 'Meera Iyer (MRD Records Officer)' }, 'Acknowledged') },
      { role: 'executive', page: 'desk', params: { ip: 'IP/26/05201' }, title: 'Fulfil', text: 'Issue the file; the escalation closes automatically.',
        done: (s) => ['Issued', 'Accepted'].includes(req(s, 'RQ-26-0312')?.status),
        auto: (run) => run('REQ_ACTION', { id: 'RQ-26-0312', action: 'issue', to: 'Dr. Vikram Rao', hours: 48 }, 'File issued – escalation auto-closed') },
    ],
  },
  {
    id: 'returnfile', n: 9, roles: ['requester', 'executive'], icon: 'PackageCheck',
    title: 'File returned & re-shelved', patient: 'Arjun Malhotra',
    story: 'Cardiology returns Arjun Malhotra’s file; MRD inspects it and puts it back in its exact position.', actor: 'Doctor → Records officer',
    action: 'Return, inspect, restore.', expected: 'File Available at its recorded position; loan closed in history.', value: 'Files come back complete and go back to the right place.',
    ready: (s) => req(s, 'RQ-26-0313')?.status === 'Accepted',
    steps: [
      { role: 'requester', page: 'myrequests', params: { req: 'RQ-26-0313' }, title: 'Return', text: 'Click “Return file”.',
        done: (s) => ['Return Submitted', 'Closed'].includes(req(s, 'RQ-26-0313')?.status),
        auto: (run) => run('REQ_ACTION', { id: 'RQ-26-0313', action: 'return', note: 'Returned via department runner' }, 'File sent back to MRD') },
      { role: 'executive', page: 'desk', params: { tab: 'returns', ip: 'IP/26/08012' }, title: 'Inspect & restore', text: 'Tick the inspection checks and restore.',
        done: (s) => req(s, 'RQ-26-0313')?.status === 'Closed',
        auto: (run) => run('REQ_ACTION', { id: 'RQ-26-0313', action: 'inspect', ok: true, notes: 'All checks passed' }, 'File restored to its archive position') },
    ],
  },
]

export const scenarioById = (id) => SCENARIOS.find((x) => x.id === id)
export const stepParams = (step, s) => (typeof step.params === 'function' ? step.params(s) : step.params) || {}
