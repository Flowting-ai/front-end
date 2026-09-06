import { redirect } from 'next/navigation'
import { CHATS_ROUTE } from '@/lib/routes'

// Tasks are now a mode of the merged Chats/Tasks library page, not a
// separate route — see src/app/(app)/chats/page.tsx's LibraryFilterButton.
// Mirrors the existing brain/chats/page.tsx redirect-stub pattern.
export default function BrainThreadsRedirect() {
  redirect(`${CHATS_ROUTE}?filter=tasks`)
}
