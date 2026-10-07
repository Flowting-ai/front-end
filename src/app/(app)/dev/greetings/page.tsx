import { notFound } from 'next/navigation'
import { GreetingsPlayground } from './GreetingsPlayground'

// Dev-only: every new-chat greeting rendered with the real heading, flagged when
// one wraps past a single line (see GreetingsPlayground). Lives inside (app) so
// it gets the real sidebar and signed-in name. 404s in production builds.
export default function DevGreetingsPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <GreetingsPlayground />
}
