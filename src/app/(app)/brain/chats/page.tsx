import { redirect } from 'next/navigation'
import { BRAIN_THREADS_ROUTE } from '@/lib/routes'

export default function BrainChatsRedirect() {
  redirect(BRAIN_THREADS_ROUTE)
}
