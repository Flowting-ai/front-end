import { redirect } from 'next/navigation'
import { CHATS_ROUTE } from '@/lib/routes'

// Redirects straight to the merged library page's Tasks mode — was a
// redirect to brain/threads, which is now itself just a redirect to this
// same destination; pointing here directly avoids the extra hop.
export default function BrainChatsRedirect() {
  redirect(`${CHATS_ROUTE}?filter=tasks`)
}
