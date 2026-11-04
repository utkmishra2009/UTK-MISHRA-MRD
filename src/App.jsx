import { useStore } from './store'
import { canAccess, PAGES } from './data/catalog'
import { Shell } from './components/Shell'
import { Empty, Button, Tabs } from './components/ui'
import Dashboard from './pages/Dashboard'
import Handover from './pages/Handover'
import Receiving from './pages/Receiving'
import Deficiencies from './pages/Deficiencies'
import Tracking from './pages/Tracking'
import Scanning from './pages/Scanning'
import QC from './pages/QC'
import Storage from './pages/Storage'
import { MyRequests, RequestDesk } from './pages/Requests'
import Escalations from './pages/Escalations'
import { Audit, Settings, Scenarios } from './pages/Misc'
import Intake from './pages/Intake'
import Start from './pages/Start'

// Scanning & Documents is one main screen with three working views
function Documents({ view }) {
  const { s, nav } = useStore()
  const V = { intake: Intake, scanning: Scanning, qc: QC }[view]
  const pending = (st) => s.documents.filter((d) => st.includes(d.status)).length
  return (
    <div className="docs-shell">
      <Tabs value={view} onChange={(v) => nav(v, {})} tabs={[
        { id: 'intake', label: 'Scan, tag & map files', icon: 'FileScan', count: new Set(s.documents.filter((d) => d.status === 'Awaiting Scan').map((d) => d.ip)).size },
        { id: 'scanning', label: 'Quick scan & rework', icon: 'ScanLine', count: pending(['QC Rejected']) },
        { id: 'qc', label: 'Scan check (page QC)', icon: 'ShieldCheck', count: pending(['QC Pending']) },
      ]} />
      <V key={view} />
    </div>
  )
}

const VIEWS = {
  dashboard: Dashboard, handover: Handover, receiving: Receiving, deficiencies: Deficiencies, tracking: Tracking,
  intake: () => <Documents view="intake" />, scanning: () => <Documents view="scanning" />, qc: () => <Documents view="qc" />,
  patient: Tracking, search: Tracking, storage: Storage, desk: RequestDesk, myrequests: MyRequests, escalations: Escalations, audit: Audit, settings: Settings, scenarios: Scenarios,
}

export default function App() {
  const { s, nav } = useStore()
  const page = s.route?.page || 'dashboard'
  const View = VIEWS[page] || Dashboard
  const allowed = canAccess(s.role, page)
  if (page === 'start') return <Start />
  return (
    <Shell>
      {allowed ? <View key={page} /> : (
        <div className="page"><Empty icon="Lock" title={`${PAGES[page]?.label || 'This screen'} is not available for this role`} action={<Button onClick={() => nav('dashboard')}>Go to my dashboard</Button>}>Switch user from “Viewing as” at the top to use it. Access is role-based, as in the live product (enforced by the server in production).</Empty></div>
      )}
    </Shell>
  )
}
