# MRD Suite — HMIS-integrated Medical Records workflow (prototype v0.3)

A React prototype of a Medical Records Department (MRD) module for Indian hospitals. It replaces the ward handover
register, MRD inward register, deficiency chits, phone follow-ups and Excel trackers with one connected workflow:

**Discharge → Record preparation → Nurse handover → MRD receipt → Review / QC → Deficiency correction → Verification →
Final acceptance → Archival & tracking**

All patients, staff and the hospital are fictitious. HMIS/ADT, EMR, LIS, RIS, scanners and e-signatures are
**simulated** — nothing is integrated, and data is kept only in the browser (localStorage).

## Run
```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # production build → dist/
npm run build:single   # one self-contained HTML file → dist-single/index.html
```
Node 18+. No backend or credentials. **Demo Settings → Reset demo data** restores the seed.

## Six main screens
| Screen | Who | What happens there |
|---|---|---|
| **MRD Dashboard** | everyone | Summary counts and one worklist: *My Pending Tasks*, Records Not Sent, Awaiting Receipt, Awaiting Review, Corrections Required, Awaiting Verification, Ready for Acceptance. Every row shows what is pending, who is responsible, how long it has waited, and one primary action. |
| **Nurse Handover** | ward nurses | *Records Not Sent* / *Records Sent*, filters (UHID, IP no., name, ward, discharge date range, status). 3-step guided drawer: document checklist (paper items + electronic items already in HMIS, optional ward scan) → missing items & remarks → review & send. Incomplete files are blocked unless an **authorized exception** (reason + authorizer + confirmation) is recorded. Draft save, resend after return (versioned), printable acknowledgement slip. |
| **MRD Receiving & QC** | receiving staff, reviewers, records officers | *Receive Record* (identity, document count, condition → acknowledge / return to ward / escalate), *Review Record* (per-document Physical / Digital / verdict, scan & scan-check inline, raise deficiencies, ICD coding, complete review), *Accept Record* (acceptance checklist + suggested archive position). |
| **Clinical Deficiencies** | doctors, nurses, reviewers | One task per issue (missing document, incomplete documentation, missing signature, incorrect document, clinical clarification), each with owner, due time and its own history. *Resolve Issue* (note, simulated e-sign, attach corrected scan) → *Verify Correction* (accept / reject with reason → reopens) → reopen or supervisor waiver. |
| **Scanning & Documents** | scanning, receiving, reviewers | Bulk intake (scan/upload → tag pages into documents → map to patient file → submit), quick scan & rework, page-level scan check. |
| **Record Tracking** | everyone | Search any admission; progress tracker, four separate status dimensions, activity history with previous → new status, deficiencies, documents, handover versions, file custody. Also opens as a drawer from every screen (“Lifecycle”). |

Tools: File Requests (issue / return physical files), Archive Map, TAT & Escalations, Audit Log, Demo Settings.

## Workflow rules (implemented in `src/store.jsx`)
- One workflow status per encounter, changed **only by actions** (send, receive, return, complete review, raise / submit /
  verify / reject / waive deficiency, accept, reopen). Invalid transitions are refused with a clear message.
- Status is recomputed automatically after deficiency activity: open issues → *Corrections Required*; all submitted →
  *Awaiting Verification*; none active → *Ready for Acceptance*.
- Every significant action is written to the record history with previous and new status, action, user, time, remarks
  and next owner.
- Four dimensions are tracked separately: **workflow status**, **physical file custody**, **digital copy availability**,
  **task ownership**.
- Encounters are never merged because they share a UHID; other admissions of the same patient are linked, not combined.
- Final acceptance is allowed while scans are still pending (tracked separately); ICD coding is optional before acceptance.
- In production, audit logging, access control and transition rules must be enforced by the backend, not only by this UI.

## Guided demo (same state, same action handlers)
Open **Guided Demo** → *Play automatically* or *Step through*. Controls: Play / Pause / Resume, Previous, Next
(“Do it for me” when the step isn’t done yet), Restart, Exit (keep changes) or Exit & undo. Each step snapshots the state,
so Previous / Restart rewind cleanly and replays never duplicate data; a demo whose patient has already moved on asks to
reset first.

| # | Demo | Patient |
|---|---|---|
| 1 | **End-to-end: discharge to archive** — nurse sends, MRD receives, reviews & scans, raises 2 deficiencies, doctor e-signs, nurse corrects, **one correction rejected**, resubmitted, verified, accepted, lifecycle viewed | Rohan Kulkarni |
| 2 | Incomplete file returned to ward, fixed and resent (version 2) | Lakshmi Narayanan |
| 3 | Bulk intake: scan, tag & map a received file | Priya Deshmukh |
| 4 | Upload & map an outside report | Joseph D'Souza |
| 5 | Unreadable scan caught & rescanned | Kiran Patil |
| 6 | Department requests an archived file | Ramesh Agarwal |
| 7 | Missing pages reported & resolved | Sushila Pandey |
| 8 | TAT breach escalates automatically | Vinod Chavan |
| 9 | File returned & re-shelved | Arjun Malhotra |

Outside the demo, pick any of 18 users in 7 groups from the start screen (or *Viewing as*) and work freely.

## Code map
```
src/data/catalog.js      roles, users, screens & access, workflow statuses, deficiency categories, document types, TATs
src/data/seed.js         fictitious encounters at every workflow status, with status histories and deficiencies
src/data/scenarios.js    guided demos; each step has done() and auto() using the real store actions
src/lib/logic.js         status / custody / digital / ownership model, checklist, task model, TAT alerts
src/store.jsx            all workflow actions and validations, audit history, escalation sync, snapshots, persistence
src/components/          Shell, UI kit, Lifecycle (tracker, dimensions, history), ReviewKit, Demo player, PrintSlip, DocPage
src/pages/               Dashboard, Handover, Receiving, Deficiencies, Tracking, Intake/Scanning/QC, Requests, Storage, Escalations, Misc, Start
```

## Assumptions to confirm with the hospital
- Checklist rules (procedure → consent + operative notes; surgery → anaesthesia consent & record; delivery →
  partograph; DAMA / death forms) are illustrative.
- Exception approval is recorded by the nurse with the authorizer’s name; production should capture it in the
  authorizer’s own login.
- TAT values are illustrative and editable in Demo Settings.
