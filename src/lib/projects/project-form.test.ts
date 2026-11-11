import { describe, expect, it } from 'vitest'
import { validateForm } from '@/lib/forms/zod-form'
import { MAX_PROJECT_TAGS, addTag, projectFormSchema } from './project-form'
import { TAG_COLORS, type ProjectTag } from './project-model'

const form = { name: '  Launch  ', description: ' Plans ', tags: [] as ProjectTag[], visibility: 'personal' as const }

describe('projectFormSchema', () => {
  it('trims the name and description it sends', () => {
    expect(validateForm(projectFormSchema, form).data).toEqual({ ...form, name: 'Launch', description: 'Plans' })
  })

  it('asks for a name and allows an empty description', () => {
    expect(validateForm(projectFormSchema, { ...form, name: '  ' }).errors).toEqual({ name: 'Enter a name' })
    expect(validateForm(projectFormSchema, { ...form, description: '' }).data).not.toBeNull()
  })
})

describe('addTag', () => {
  it('adds a trimmed tag whose id is its label, with the next colour', () => {
    expect(addTag([], ' Q3 ', TAG_COLORS)).toEqual([{ id: 'Q3', label: 'Q3', color: TAG_COLORS[0] }])
  })

  it('refuses empty text, a duplicate in any case, and a tag past the limit', () => {
    const tags = addTag([], 'Q3', TAG_COLORS)!
    expect(addTag(tags, '  ', TAG_COLORS)).toBeNull()
    expect(addTag(tags, 'q3', TAG_COLORS)).toBeNull()
    const full = Array.from({ length: MAX_PROJECT_TAGS }, (_, i) => ({ id: `t${i}`, label: `t${i}`, color: TAG_COLORS[0] }))
    expect(addTag(full, 'more', TAG_COLORS)).toBeNull()
  })
})
