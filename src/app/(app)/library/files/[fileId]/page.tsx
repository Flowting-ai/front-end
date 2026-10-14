import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { isValidFileId } from '@/lib/library/ids'
import { FileScreen } from '@/components/Library/FileScreen'
import { FileRouteLoading } from '@/components/Library/LibrarySkeletons'

export const metadata = { title: 'File | Library' }

// A malformed id is a real 404. A missing, deleted or locked file is a state the screen shows (it
// needs the signed-in user's token, which lives in the browser), so nothing about it is fetched here.
export default async function LibraryFilePage({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params
  if (!isValidFileId(fileId)) notFound()
  return (
    <Suspense fallback={<FileRouteLoading />}>
      <FileScreen id={fileId} />
    </Suspense>
  )
}
