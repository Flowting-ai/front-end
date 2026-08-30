import { describe, expect, it } from 'vitest'
import { PersonaRepo, PersonaRepoCollection, MAX_VERSIONS_PER_REPO } from './persona-repo'
import { personaRepoSchema, personaVersionSchema } from './persona-schemas'

function version(overrides: Record<string, unknown> = {}) {
  return personaVersionSchema.parse({
    id: 'version-1',
    persona_repo_id: 'repo-1',
    name: 'Sales Agent',
    handler: 'sales_agent',
    prompt: 'Help with sales',
    is_active: true,
    created_at: '2026-06-18T00:00:00Z',
    updated_at: '2026-06-18T00:00:00Z',
    ...overrides,
  })
}

function repo(overrides: Record<string, unknown> = {}) {
  return new PersonaRepo(personaRepoSchema.parse({
    id: 'repo-1',
    name: 'Sales Agent',
    is_active: true,
    version_count: 1,
    visibility: 'private',
    created_at: '2026-06-18T00:00:00Z',
    updated_at: '2026-06-18T00:00:00Z',
    ...overrides,
  }))
}

describe('PersonaRepo version pointers', () => {
  it('maps published_version to live and active_version to working', () => {
    const r = repo({
      published_version_id: 'version-live',
      published_version: version({ id: 'version-live', prompt: 'live' }),
      active_version_id: 'version-draft',
      active_version: version({ id: 'version-draft', prompt: 'draft' }),
    })

    expect(r.liveVersion?.id).toBe('version-live')
    expect(r.workingVersion?.id).toBe('version-draft')
    expect(r.currentVersion?.id).toBe('version-live')
    expect(r.isPublished).toBe(true)
  })

  it('falls back to the working version when nothing is published', () => {
    const r = repo({ active_version_id: 'version-draft', active_version: version({ id: 'version-draft' }) })

    expect(r.liveVersion).toBeNull()
    expect(r.currentVersion?.id).toBe('version-draft')
    expect(r.isPublished).toBe(false)
    expect(r.status).toBe('draft')
  })

  it('reports paused regardless of publish state', () => {
    const r = repo({ is_active: false, published_version_id: 'version-live', published_version: version() })

    expect(r.isPaused).toBe(true)
    expect(r.status).toBe('paused')
  })

  it('caps new versions at the backend limit', () => {
    expect(repo({ version_count: MAX_VERSIONS_PER_REPO - 1 }).canAddVersion).toBe(true)
    expect(repo({ version_count: MAX_VERSIONS_PER_REPO }).canAddVersion).toBe(false)
  })

  it('derives a handle from the name when no version carries one', () => {
    expect(repo({ name: 'Sales Agent' }).handle).toBe('@sales_agent')
    expect(repo({ active_version: version({ handler: 'custom' }) }).handle).toBe('@custom')
  })
})

describe('PersonaRepo.toPersona', () => {
  it('projects the live version, keeping activeVersionId on the published pointer', () => {
    const persona = repo({
      published_version_id: 'version-live',
      published_version: version({ id: 'version-live', connectors: ['slack'], blocked_connectors: ['gmail'] }),
      active_version_id: 'version-draft',
      active_version: version({ id: 'version-draft' }),
    }).toPersona()

    expect(persona.activeVersionId).toBe('version-live')
    expect(persona.workingVersionId).toBe('version-draft')
    expect(persona.connectorSlugs).toEqual(['slack'])
    expect(persona.blockedConnectorSlugs).toEqual(['gmail'])
    expect(persona.status).toBe('active')
    expect(persona.hasSystemInstructions).toBe(true)
  })

  it('marks a blank prompt as having no system instructions', () => {
    const persona = repo({ active_version: version({ prompt: '   ' }) }).toPersona()
    expect(persona.hasSystemInstructions).toBe(false)
  })
})

describe('PersonaRepoCollection', () => {
  const published = repo({ id: 'published', published_version_id: 'v', published_version: version() })
  const draft = repo({ id: 'draft', active_version: version() })
  const teamAgent = repo({ id: 'team-agent', visibility: 'shared', published_version_id: 'v', published_version: version() })
  const collection = new PersonaRepoCollection([published, draft, teamAgent])

  it('looks agents up by id', () => {
    expect(collection.get('draft')?.id).toBe('draft')
    expect(collection.get('missing')).toBeNull()
    expect(collection.size).toBe(3)
  })

  it('splits published from drafts', () => {
    expect(collection.published().map(r => r.id)).toEqual(['published', 'team-agent'])
    expect(collection.drafts().map(r => r.id)).toEqual(['draft'])
  })

  it('scopes to org-shared agents only inside a project context', () => {
    expect(collection.forTeam('team-1').map(r => r.id)).toEqual(['team-agent'])
    // A private agent must never leak into an org-shared project context.
    expect(collection.forTeam('team-1')).not.toContainEqual(expect.objectContaining({ id: 'published' }))
    // Outside a project context the list is unchanged.
    expect(collection.forTeam(null)).toHaveLength(3)
  })
})
