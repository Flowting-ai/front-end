import { notFound } from 'next/navigation'
import { LIBRARY_ENABLED } from '@/lib/feature-flags'
import { TrashScreen } from '@/components/Library/TrashScreen'

export const metadata = { title: 'Trash | Library' }

export default function LibraryTrashPage() {
  if (!LIBRARY_ENABLED) notFound()
  return <TrashScreen />
}
