import { toast } from 'sonner'

// One toast slot for the agent edit panel, shared by every place it opens or closes (the
// /agents page sidebar, the Agents panel's details view), so entering, switching and leaving
// always read the same and never stack.
const TOAST_ID = 'agent-details-panel'

export function toastAgentDetailsOpened(name?: string | null): void {
  toast(name ? `Editing ${name}` : 'Agent details opened', { id: TOAST_ID, duration: 1800 })
}

export function toastAgentDetailsClosed(): void {
  toast('Closed agent details', { id: TOAST_ID, duration: 1500 })
}
