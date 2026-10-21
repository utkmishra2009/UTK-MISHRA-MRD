import { useState } from 'react'
import { HOSPITAL, docType } from '../data/catalog'
import { fmtDate } from '../lib/logic'
import { Icon, Button } from './ui'

const KIND = { PN: 'notes', NN: 'notes', OP: 'notes', AR: 'chart', IA: 'notes', DS: 'notes', MAR: 'chart', TPR: 'chart', IO: 'chart', PG: 'chart', GC: 'consent', SC: 'consent', AC: 'consent', DAMA: 'consent', LAB: 'report', RAD: 'report', ECG: 'ecg', INS: 'report', DTH: 'notes', OTH: 'notes', UNMAPPED: 'report' }
const HAND = { PN: true, NN: true, OP: true, AR: true, MAR: true, TPR: true, IO: true, PG: true }

function rng(seedStr) {
  let h = 2166136261
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 }
}

function scribble(r, x, y, w) {
  let d = `M${x} ${y}`
  let cx = x
  while (cx < x + w) {
    const step = 3 + r() * 5
    cx += step
    d += ` q${step / 2} ${-3 - r() * 4} ${step} 0`
    if (r() < 0.12) { cx += 6; d += ` m6 0` }
  }
  return d
}

export function PageSVG({ doc, page, patient, enc, showDefect = true }) {
  const r = rng(`${doc.id}-${page.n}-${page.replaced || 0}`)
  const look = page.look || doc.type
  const kind = KIND[look] || 'notes'
  const hand = HAND[look]
  const defect = showDefect ? page.defect : null
  const W = 420, Hh = 594
  const title = doc.type === 'UNMAPPED' ? doc.claimedType : docType(look).name
  const ptName = defect === 'wrongpt' ? 'SUNIL KULKARNI' : (patient?.name || doc.claimedName || '').toUpperCase()
  const ink = hand ? '#23408e' : '#222'
  const body = []
  if (page.upload?.src) {
    body.push(<image key="img" href={page.upload.src} x="24" y="96" width={W - 48} height={Hh - 140} preserveAspectRatio="xMidYMid meet" />)
  } else if (page.upload) {
    body.push(<g key="pdf"><rect x="60" y="180" width={W - 120} height="200" rx="8" fill="#f3f1ea" stroke="#c9c3b3" strokeDasharray="5 4" /><text x={W / 2} y="265" textAnchor="middle" fontSize="13" fill="#555">{page.upload.name}</text><text x={W / 2} y="288" textAnchor="middle" fontSize="10" fill="#888">Uploaded file · page preview simulated</text></g>)
  } else if (defect === 'blank') {
    for (let i = 0; i < 40; i++) body.push(<circle key={i} cx={r() * W} cy={100 + r() * 460} r={r() * 0.9} fill="#999" />)
  } else if (kind === 'notes') {
    let y = 118
    for (let i = 0; i < 17; i++) {
      if (i % 4 === 0) body.push(<text key={`t${i}`} x="28" y={y + 3} fontSize="8" fill="#666" fontFamily="monospace">{`${(8 + i) % 24}:${i % 2 ? '30' : '00'}`}</text>)
      const w = 250 + r() * 90
      if (hand) body.push(<path key={i} d={scribble(r, 70, y, w)} stroke={ink} strokeWidth="1.1" fill="none" opacity=".85" />)
      else body.push(<rect key={i} x="70" y={y - 4} width={w} height="5" rx="2" fill="#bbb" />)
      body.push(<line key={`l${i}`} x1="24" x2={W - 24} y1={y + 8} y2={y + 8} stroke="#e3dfd5" strokeWidth=".6" />)
      y += 25
    }
    body.push(<path key="sig" d={scribble(r, W - 150, 552, 90)} stroke={ink} strokeWidth="1.4" fill="none" />)
    body.push(<text key="sigl" x={W - 150} y="566" fontSize="7.5" fill="#666">Signature &amp; stamp</text>)
  } else if (kind === 'chart') {
    const rows = 13, cols = 7
    for (let i = 0; i <= rows; i++) body.push(<line key={`h${i}`} x1="24" x2={W - 24} y1={112 + i * 30} y2={112 + i * 30} stroke="#9aa" strokeWidth=".7" />)
    for (let j = 0; j <= cols; j++) body.push(<line key={`v${j}`} y1="112" y2={112 + rows * 30} x1={24 + (j * (W - 48)) / cols} x2={24 + (j * (W - 48)) / cols} stroke="#9aa" strokeWidth=".7" />)
    for (let i = 0; i < rows; i++) for (let j = 1; j < cols; j++) if (r() > 0.35) body.push(<path key={`m${i}-${j}`} d={scribble(r, 30 + (j * (W - 48)) / cols, 130 + i * 30, 22)} stroke={ink} strokeWidth="1" fill="none" />)
    ;['Time', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6'].forEach((h, j) => body.push(<text key={`c${j}`} x={30 + (j * (W - 48)) / cols} y="106" fontSize="8" fill="#444">{h}</text>))
  } else if (kind === 'consent') {
    let y = 120
    for (let i = 0; i < 14; i++) { body.push(<rect key={i} x="32" y={y} width={(i % 5 === 4 ? 200 : 350) - r() * 20} height="4.5" rx="2" fill="#c3c3c3" />); y += 15 }
    ;['Patient / Guardian', 'Witness', 'Doctor'].forEach((lbl, k) => {
      const x = 32 + k * 125
      body.push(<rect key={`b${k}`} x={x} y="440" width="112" height="70" fill="none" stroke="#999" strokeWidth=".7" />)
      body.push(<path key={`s${k}`} d={scribble(r, x + 12, 480, 80)} stroke={ink === '#222' ? '#23408e' : ink} strokeWidth="1.4" fill="none" />)
      body.push(<text key={`t${k}`} x={x + 4} y="524" fontSize="7.5" fill="#555">{lbl}</text>)
    })
  } else if (kind === 'ecg') {
    for (let k = 0; k < 4; k++) {
      let d = `M24 ${170 + k * 95}`
      for (let x = 24; x < W - 24; x += 34) d += ` l8 0 l3 -4 l3 4 l3 0 l2 6 l3 -42 l3 46 l3 -10 l6 0 l5 -8 l5 8`
      body.push(<path key={k} d={d} stroke="#a01818" strokeWidth="1" fill="none" />)
    }
  } else {
    let y = 128
    ;[['Test / Parameter', 'Result', 'Ref. range'], ...Array.from({ length: 12 }, () => ['', '', ''])].forEach((row, i) => {
      if (i === 0) row.forEach((c, j) => body.push(<text key={`h${j}`} x={30 + j * 130} y={y} fontSize="9" fontWeight="700" fill="#333">{c}</text>))
      else { body.push(<rect key={`a${i}`} x="30" y={y - 7} width={60 + r() * 50} height="5" rx="2" fill="#aaa" />); body.push(<text key={`b${i}`} x="160" y={y} fontSize="9" fill="#222" fontFamily="monospace">{(r() * 140).toFixed(1)}</text>); body.push(<rect key={`c${i}`} x="290" y={y - 7} width="70" height="5" rx="2" fill="#ccc" />) }
      body.push(<line key={`l${i}`} x1="24" x2={W - 24} y1={y + 6} y2={y + 6} stroke="#e8e8e8" strokeWidth=".6" />)
      y += 24
    })
    body.push(<text key="el" x="30" y="520" fontSize="8" fill="#555">Electronically authorised · {doc.source} · {fmtDate(doc.docDate)}</text>)
  }

  const fid = `f-${doc.id}-${page.n}`
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="pagesvg" role="img" aria-label={`${title}, page ${page.n}`}>
      <defs>
        <filter id={`${fid}-b`}><feGaussianBlur stdDeviation="2.4" /></filter>
        <clipPath id={`${fid}-c`}><path d={`M0 0 H${W * 0.66} l8 40 l-10 60 l12 80 l-9 120 l10 140 l-6 154 H0 Z`} /></clipPath>
      </defs>
      <rect width={W} height={Hh} fill={defect === 'blank' ? '#fbfaf6' : '#fffef9'} />
      <g filter={defect === 'blur' ? `url(#${fid}-b)` : undefined} opacity={defect === 'blur' ? 0.55 : 1} clipPath={defect === 'cut' ? `url(#${fid}-c)` : undefined}>
        {defect !== 'blank' && (
          <>
            <rect x="24" y="22" width="30" height="30" rx="5" fill="#1f5a52" /><text x="39" y="42" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">A</text>
            <text x="62" y="34" fontSize="10.5" fontWeight="700" fill="#1f2a37">{HOSPITAL.name.toUpperCase()}</text>
            <text x="62" y="47" fontSize="8" fill="#666">{HOSPITAL.city} · Medical Records</text>
            <text x={W - 24} y="38" textAnchor="end" fontSize="11" fontWeight="700" fill="#1f2a37">{title}</text>
            <rect x="24" y="60" width={W - 48} height="26" fill="#f2efe6" stroke="#d8d2c2" strokeWidth=".6" />
            <text x="30" y="77" fontSize="8.2" fill="#222"><tspan fontWeight="700">{ptName}</tspan>{`   UHID ${doc.uhid || '—'}   IP ${doc.ip || '—'}   ${enc?.ward || ''} ${enc?.bed ? `/ ${enc.bed}` : ''}`}</text>
          </>
        )}
        {body}
        <text x={W / 2} y={Hh - 12} textAnchor="middle" fontSize="7.5" fill="#888">Page {page.n} of {doc.pages.length} · {doc.id}{page.replaced ? ` · rescanned r${page.replaced}` : ''}</text>
      </g>
    </svg>
  )
}

export function DocViewer({ doc, patient, enc, pageTools, sideTools, initial = 0, markOf }) {
  const [i, setI] = useState(initial)
  const [zoom, setZoom] = useState(1)
  const [rot, setRot] = useState(0)
  const page = doc.pages[Math.min(i, doc.pages.length - 1)]
  if (!page) return <div className="viewer-empty">No pages scanned yet.</div>
  return (
    <div className="viewer">
      <div className="thumbs" role="listbox" aria-label="Pages">
        {doc.pages.map((pg, k) => (
          <button key={pg.n} role="option" aria-selected={k === i} className={`thumb ${k === i ? 'on' : ''}`} onClick={() => { setI(k); setRot(0) }}>
            <div className="thumb-img" style={{ transform: `rotate(${pg.rot}deg)` }}><PageSVG doc={doc} page={pg} patient={patient} enc={enc} /></div>
            <span>p{pg.n}</span>
            {markOf?.(pg) && <i className={`thumb-mark mk-${markOf(pg) === 'Clear' ? 'ok' : 'bad'}`} title={markOf(pg)} />}
          </button>
        ))}
      </div>
      <div className="stage">
        <div className="stage-bar">
          <Button size="sm" icon="ChevronLeft" onClick={() => { setI(Math.max(0, i - 1)); setRot(0) }} disabled={i === 0} aria-label="Previous page" />
          <span className="pg-of">Page {page.n} / {doc.pages.length}</span>
          <Button size="sm" icon="ChevronRight" onClick={() => { setI(Math.min(doc.pages.length - 1, i + 1)); setRot(0) }} disabled={i >= doc.pages.length - 1} aria-label="Next page" />
          <span className="sp" />
          <Button size="sm" icon="ZoomOut" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} aria-label="Zoom out" />
          <span className="pg-of">{Math.round(zoom * 100)}%</span>
          <Button size="sm" icon="ZoomIn" onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))} aria-label="Zoom in" />
          <Button size="sm" icon="RotateCw" onClick={() => setRot((x) => (x + 90) % 360)} aria-label="Rotate view">Rotate view</Button>
        </div>
        <div className="stage-canvas">
          <div className="paper" style={{ width: `${zoom * 100}%`, transform: `rotate(${(page.rot + rot) % 360}deg)` }}>
            <PageSVG doc={doc} page={page} patient={patient} enc={enc} />
          </div>
        </div>
        {pageTools && <div className="stage-tools">{pageTools(page)}</div>}
      </div>
      {sideTools && <div className="viewer-side">{sideTools(page)}</div>}
    </div>
  )
}

export { Icon }
