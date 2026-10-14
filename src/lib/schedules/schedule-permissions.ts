/**
 * Who may do what with a schedule, mirroring the backend: anyone in the org can
 * read an organization schedule (the org row carries `ownerName`), only its
 * owner can change, run or delete it; a non-owner can copy it into their own.
 * One place instead of `!!schedule.ownerName` checks per component.
 */
export type ScheduleAction = 'edit' | 'delete' | 'toggle' | 'run' | 'view-history' | 'copy'

export function canSchedule(action: ScheduleAction, schedule: { ownerName?: string | null } | null | undefined): boolean {
  if (!schedule) return false
  const owned = !schedule.ownerName
  return action === 'copy' ? !owned : owned
}
