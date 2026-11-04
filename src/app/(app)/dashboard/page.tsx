import { DashboardScreen } from './DashboardScreen'

export const metadata = { title: 'Dashboard' }

// A server shell only; the screen is a client island because the tab, range and table page hold state.
export default function DashboardPage() {
  return <DashboardScreen />
}
