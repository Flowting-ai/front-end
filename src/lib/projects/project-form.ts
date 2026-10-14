import { z } from 'zod'
import type { ProjectTag } from './project-model'
import type { ProjectVisibility } from '@/lib/api/projects'

// The create/edit project form (EditProjectModal), checked with useZodForm (decision D9). The
// parsed values are what onSave sends, so the form and the request share one set of rules.

export const MAX_PROJECT_TAGS = 5
export const MAX_PROJECT_NAME = 255

export interface ProjectFormValues extends Record<string, unknown> {
  name: string
  description: string
  tags: ProjectTag[]
  visibility: ProjectVisibility
}

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(MAX_PROJECT_NAME, `Use ${MAX_PROJECT_NAME} characters or fewer`),
  description: z.string().trim(),
  tags: z.array(z.custom<ProjectTag>((v) => typeof v === 'object' && v !== null)).max(MAX_PROJECT_TAGS, `Up to ${MAX_PROJECT_TAGS} tags`),
  visibility: z.enum(['personal', 'workspace', 'shared']) satisfies z.ZodType<ProjectVisibility>,
})

export type ProjectFormData = z.infer<typeof projectFormSchema>

/** A new tag from typed text, or null when it is empty, a duplicate, or over the limit. Its id is its label (the backend stores labels). */
export function addTag(tags: ProjectTag[], text: string, colors: readonly ProjectTag['color'][]): ProjectTag[] | null {
  const label = text.trim()
  if (!label || tags.length >= MAX_PROJECT_TAGS || tags.some(t => t.label.toLowerCase() === label.toLowerCase())) return null
  return [...tags, { id: label, label, color: colors[tags.length % colors.length] }]
}
