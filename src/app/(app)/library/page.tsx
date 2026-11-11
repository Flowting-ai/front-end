import { Suspense } from 'react'
import { LibraryScreen } from '@/components/Library/LibraryScreen'
import { LibraryRouteLoading } from '@/components/Library/LibrarySkeletons'

export const metadata = { title: 'Library' }

// A server shell only: it reads no request data, so the route stays static. The screen is a client
// island (React Query + URL state); useSearchParams inside it needs this Suspense boundary.
export default function LibraryPage() {
  return (
    <Suspense fallback={<LibraryRouteLoading />}>
      <LibraryScreen />
    </Suspense>
  )
}
