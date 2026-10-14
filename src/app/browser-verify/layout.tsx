import { notFound } from 'next/navigation'

// A dev-only verification harness: proxy.ts lets it through without a session in
// dev, and a deployed build must not serve it at all.
export default function DevOnlyLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return children
}
