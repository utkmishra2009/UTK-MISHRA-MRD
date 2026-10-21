# MRD Management System — Interactive Prototype (POC)

Client-facing demo of the complete medical-record lifecycle in an Indian hospital:
discharge → ward handover → MRD receipt → scanning & indexing → QC → completeness & ICD coding →
storage → department request → issue / acceptance → discrepancy & TAT escalation → return & re-shelving,
with a Patient 360° view and an append-only audit trail.

All patients, UHIDs, staff and the hospital ("Arogya Demo Multispeciality Hospital") are fictitious.
HIS/ADT, EMR, LIS, RIS, scanner hardware and ICD lookup are **simulated** — nothing is integrated.

## Run
```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # production build → dist/
npm run build:single   # one self-contained HTML file → dist-single/index.html
```
Requires Node 18+. No backend, no credentials. Demo state is saved in the browser (localStorage);
use **Demo Settings → Reset demo data** to start over.

## Two ways to use it
The app opens on a start screen with two options:

- **A · Guided demo** — 11 scenarios, each with its own seeded patient, playable in any order. A guide panel shows the
  role you are playing, what to do, and ticks the step when it is done.
- **B · Explore freely as a user** — pick any person from any of the 7 user groups (16 demo users) and use their screens
  on your own. Each dashboard lists "Things you can do". Switch user any time from **Viewing as** in the top bar or
  **Switch user / mode** in the menu. Nurses can simulate new admissions and discharges to create fresh patients.

The **demo clock** (+1 h / +4 h / +1 d) drives TATs, overdue flags and automatic escalations in both modes.

## Document intake (after the physical file is received in MRD)
**Document Intake** is a 4-step workspace used by Scanning, Receiving, MRD Executive and Supervisor:
1. **Capture** — scan the whole received file as one batch (simulated feeder scanner), or upload files
   (PDF/JPG/PNG/TIFF, 25 MB limit, empty-file check). Loose / outside documents start their own batch.
2. **Tag documents** — select pages (click / Shift-click) and tag them as a document: type, classification folder,
   tags (Original, Signed, Outside hospital, Legal/MLC…), clinical date, author, and the handover item it fulfils.
   Expected items from the ward handover are one-click chips; blank/separator sheets can be excluded.
3. **Map to patient file** — confirm UHID, admission and physical file (search for loose documents). Closed records are blocked.
   A reconciliation table compares tagged documents with the handover list.
4. **Review & submit** — untagged pages block submission; duplicates need a reason; documents go to QC and appear in Patient 360°.
**Quick Scan & Rework** remains for scanning one expected document at a time and fixing QC rejections.

| # | Scenario | Seed patient | Roles |
|---|---|---|---|
| 1 | Discharge to MRD | Rohan Kulkarni | Nursing |
| 2 | MRD receiving & verification | Lakshmi Narayanan | Receiving |
| 3 | Document intake: scan, tag & map | Priya Deshmukh | Scanning → QC |
| 4 | QC failure & correction | Kiran Patil | QC → Scanning → QC |
| 5 | Completeness & ICD coding | Mohan Verma | MRD Executive |
| 6 | Storage & retrieval | Deepa Nair | Executive → Department → Executive |
| 7 | Department file request | Ramesh Agarwal | Department → Executive → Department |
| 8 | Missing/damaged file escalation | Sushila Pandey | Department → Supervisor |
| 9 | TAT breach & escalation | Vinod Chavan | Supervisor → Executive |
| 10 | Return & closure | Arjun Malhotra | Department → Executive |
| 11 | Upload & map an outside document | Joseph D'Souza | Scanning |

## Code map
```
src/data/catalog.js    roles, page access, document types, checklist rules, demo ICD-10 catalogue, storage layout, default TATs
src/data/seed.js       seeded fictitious patients/encounters/documents/files/requests at every lifecycle stage
src/data/scenarios.js  guided scenarios with live completion checks
src/lib/logic.js       derived lifecycle stage, checklist, file status, TAT & escalation calculation, formatting
src/store.jsx          single state store: every workflow action, business-rule validation, audit logging, escalation sync, persistence
src/components/        shell (nav, role switcher, demo clock, guide), UI kit, document page renderer & viewer
src/pages/             one screen per module (Start, Dashboard, Intake, Handover, Receiving, Scanning, QC, Coding, Storage, Requests, Escalations, Patient 360, Search, Audit, Settings, Guided Demo)
```

## Demo assumptions (to confirm with client)
- Physical file tracking and ICD coding are shown although the developer requirements mark them Phase 2 (OQ-11, OQ-12).
- Completeness checklist rules (procedure, surgery, delivery, DAMA, death) are illustrative (OQ-02).
- Scanning and QC are separate roles here; the brief PRD groups them under "MRD Operator".
- TAT values are illustrative and editable in Demo Settings; PRD defaults kept where stated (48 h access window).
- QC is a human decision — no automated image-quality detection. ICD suggestions are a keyword match, not clinical coding.
