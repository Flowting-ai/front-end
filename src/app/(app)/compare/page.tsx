import { notFound } from 'next/navigation'
import { CompareLab } from './CompareLab'

// Dev-only routing-lab recorder (talks to a local lab on :8777 through
// /api/lab, which is itself 404 in production). 404s in production builds.
export default function ComparePage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <CompareLab />
}
