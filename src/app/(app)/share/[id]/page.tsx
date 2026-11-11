import type { Metadata } from 'next'
import { loadSharePreviewOnServer } from '@/lib/share/share-preview-server'
import { ShareAcceptClient } from './ShareAcceptClient'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

// The preview needs the viewer's session, so this title shows in the tab, not
// in link unfurls (those would need a public preview endpoint — backend gap).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const initial = await loadSharePreviewOnServer((await params).id)
  if (initial?.kind === 'preview') {
    return { title: `${initial.preview.persona_name} · shared by ${initial.preview.shared_by_name}` }
  }
  return { title: 'Shared agent' }
}

/** /share/[id] — accept a Super Link. The preview is loaded here when possible. */
export default async function ShareAcceptPage({ params }: Props) {
  const initial = await loadSharePreviewOnServer((await params).id)
  return <ShareAcceptClient initial={initial} />
}
