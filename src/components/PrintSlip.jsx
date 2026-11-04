import { useStore } from '../store'
import { HOSPITAL, docType } from '../data/catalog'
import { encOf, patientOf, fmtDT } from '../lib/logic'
import { Modal, Button } from './ui'

// Printable handover / receipt acknowledgement — replaces the handwritten entry in the ward–MRD register
export function PrintSlip({ open, onClose, ip, kind = 'handover' }) {
  const { s } = useStore()
  if (!open) return null
  const e = encOf(s, ip)
  const p = patientOf(s, e.uhid)
  const h = e.handover
  if (!h) return null
  const received = !!h.receivedAt
  return (
    <Modal open onClose={onClose} title={kind === 'receipt' ? 'MRD receipt acknowledgement' : 'Handover acknowledgement'} subtitle="Print and attach to the file cover, or keep as the ward copy"
      footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" icon="Printer" onClick={() => window.print()}>Print</Button></>}>
      <div className="print-area slip">
        <header><strong>{HOSPITAL.name}</strong><span>Medical Records Department · {kind === 'receipt' ? 'Receipt' : 'Handover'} acknowledgement</span></header>
        <table>
          <tbody>
            <tr><th>Reference</th><td>{h.ref}{h.version > 1 ? ` (v${h.version})` : ''}</td><th>Printed</th><td>{fmtDT(s.now)}</td></tr>
            <tr><th>Patient</th><td>{p.name} · {p.age}/{p.sex}</td><th>UHID</th><td>{e.uhid}</td></tr>
            <tr><th>IP number</th><td>{e.ip}</td><th>Ward / bed</th><td>{e.ward} / {e.bed}</td></tr>
            <tr><th>Discharged</th><td>{fmtDT(e.discharged)}</td><th>Consultant</th><td>{e.consultant}</td></tr>
          </tbody>
        </table>
        <h4>Documents handed over</h4>
        <table className="slip-items">
          <thead><tr><th>#</th><th>Document</th><th>Pages</th><th>Received at MRD</th></tr></thead>
          <tbody>
            {h.items.map((it, i) => <tr key={it.type}><td>{i + 1}</td><td>{docType(it.type).name}</td><td>{it.pages}</td><td>{received ? (h.check?.notReceived?.includes(it.type) ? 'NOT RECEIVED' : '✓') : '☐'}</td></tr>)}
          </tbody>
        </table>
        {h.missing?.length > 0 && <p><b>Missing:</b> {h.missing.map((m) => docType(m).name).join(', ')}{h.exception ? ` — exception authorized by ${h.exception.authorizedBy}` : ''}</p>}
        {h.remarks && <p><b>Remarks:</b> {h.remarks}</p>}
        <div className="sigs">
          <div><span>Handed over by</span><b>{h.by}</b><small>{fmtDT(h.at)}</small></div>
          <div><span>Carried by</span><b>{h.carrier}</b><small>&nbsp;</small></div>
          <div><span>Received by (MRD)</span><b>{received ? h.receivedBy : '________________'}</b><small>{received ? fmtDT(h.receivedAt) : 'Date / time'}</small></div>
        </div>
        <p className="slip-foot">System-generated from the MRD module. Electronic signatures are captured by user login and time; no handwritten register entry is needed.</p>
      </div>
    </Modal>
  )
}
