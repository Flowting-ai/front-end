import { LibraryVitals } from '@/components/Library/LibraryVitals'

// Shared by the list, Trash and file routes: only adds Web Vitals reporting (a client leaf), so the
// route shells stay server-rendered and static.
export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LibraryVitals />
      {children}
    </>
  )
}
