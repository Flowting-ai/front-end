import { describe, expect, it } from 'vitest'
import { canProject } from './project-permissions'

const owned     = { canEdit: true,  visibility: 'personal'  as const, teamId: null }
const workspace = { canEdit: false, visibility: 'workspace' as const, teamId: 'org-1' }
const shared    = { canEdit: false, visibility: 'shared'    as const, teamId: 'org-1' }

describe('canProject', () => {
  it('lets owners edit, delete and (with an org) change visibility', () => {
    expect(canProject('edit-content', owned, null)).toBe(true)
    expect(canProject('delete', owned, null)).toBe(true)
    expect(canProject('change-visibility', owned, null)).toBe(false)
    expect(canProject('change-visibility', owned, 'org-1')).toBe(true)
    expect(canProject('leave', owned, 'org-1')).toBe(false)
  })

  it('lets workspace members edit content of their own org only', () => {
    expect(canProject('edit-content', workspace, 'org-1')).toBe(true)
    expect(canProject('edit-content', workspace, 'org-2')).toBe(false)
    expect(canProject('delete', workspace, 'org-1')).toBe(false)
    expect(canProject('leave', workspace, 'org-1')).toBe(true)
  })

  it('manages members only on shared projects; nothing without a project', () => {
    expect(canProject('manage-members', shared, 'org-1')).toBe(true)
    expect(canProject('manage-members', workspace, 'org-1')).toBe(false)
    expect(canProject('edit-content', shared, 'org-1')).toBe(false)
    expect(canProject('delete', undefined, 'org-1')).toBe(false)
  })
})
