import { HomeScreen } from './HomeScreen'

export const metadata = { title: 'Home' }

// A server shell only; the screen is a client island because the period picker holds state.
export default function HomePage() {
  return <HomeScreen />
}
