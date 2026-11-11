import { LinkButton } from '@/components/Library/LinkButton'
import { LIBRARY_ROUTE } from '@/lib/routes'

export default function LibraryNotFound() {
  return (
    <div role="status" style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)' }}>No longer available</h2>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }}>This page doesn&apos;t exist or isn&apos;t available to you.</p>
      <LinkButton href={LIBRARY_ROUTE}>Back to Library</LinkButton>
    </div>
  )
}
