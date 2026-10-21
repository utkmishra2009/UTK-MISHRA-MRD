import { useStore } from './store'
import { canAccess, PAGES } from './data/catalog'
import { Shell } from './components/Shell'
import { Empty, Button } from './components/ui'
import Dashboard from './pages/Dashboard'
import Handover from './pages/Handover'
import Receiving from './pages/Receiving'
import Scanning from './pages/Scanning'
import QC from './pages/QC'
import Coding from './pages/Coding'
import Storage from './pages/Storage'
import { MyRequests, RequestDesk } from './pages/Requests'
import Escalations from './pages/Escalations'
import Patient360 from './pages/Patient360'
import { Search, Audit, Settings, Scenarios } from './pages/Misc'
import Intake from './pages/Intake'
import Start from './pages/Start'

const VIEWS = { dashboard: Dashboard, intake: Intake, handover: Handover, receiving: Receiving, scanning: Scanning, qc: QC, coding: Coding, storage: Storage, desk: RequestDesk, myrequests: MyRequests, escalations: Escalations, patient: Patient360, search: Search, audit: Audit, settings: Settings, scenarios: Scenarios }

export default function App() {
  const { s, nav } = useStore()
  const page = s.route?.page || 'dashboard'
  const View = VIEWS[page] || Dashboard
  const allowed = canAccess(s.role, page)
  if (page === 'start') return <Start />
  return (
    <Shell>
      {allowed ? <View key={page} /> : (
        <div className="page"><Empty icon="Lock" title={`${PAGES[page]?.label || 'This screen'} is not available for this role`} action={<Button onClick={() => nav('dashboard')}>Go to my dashboard</Button>}>Switch role from “Viewing as” at the top to use it. Access is role-based, as in the live product.</Empty></div>
      )}
    </Shell>
  )
}
