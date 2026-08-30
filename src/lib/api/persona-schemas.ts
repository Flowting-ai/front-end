import { z } from 'zod'

// Mirrors services/persona/schemas.py. Connector fields are slugs on the wire —
// resolve them through resolveConnector() in ./connectors, never re-derive a
// name or logo at a call site.

const nullableString = z.string().nullable().default(null)

export const personaDocumentSchema = z.object({
  id:                z.string(),
  document_filename: z.string(),
  source_url:        nullableString,
  is_org_knowledge:  z.boolean().default(false),
  created_at:        z.string(),
  size_bytes:        z.number().nullable().default(null),
  content_type:      nullableString,
  download_url:      nullableString,
})

export const personaVersionSchema = z.object({
  id:                 z.string(),
  persona_repo_id:    z.string(),
  name:               z.string(),
  handler:            z.string(),
  prompt:             z.string(),
  description:        nullableString,
  is_active:          z.boolean(),
  model_id:           nullableString,
  image_url:          nullableString,
  image_s3_key:       nullableString,
  temperature:        z.number().nullable().default(null),
  version_tags:       z.array(z.string()).default([]),
  persona_tags:       z.array(z.string()).default([]),
  connectors:         z.array(z.string()).default([]),
  blocked_connectors: z.array(z.string()).default([]),
  documents:          z.array(personaDocumentSchema).default([]),
  links:              z.array(personaDocumentSchema).default([]),
  source_share_id:    nullableString,
  created_at:         z.string(),
  updated_at:         z.string(),
})

export const personaRepoSchema = z.object({
  id:                   z.string(),
  name:                 z.string(),
  is_active:            z.boolean(),
  active_version_id:    nullableString,
  active_version:       personaVersionSchema.nullable().default(null),
  published_version_id: nullableString,
  published_version:    personaVersionSchema.nullable().default(null),
  published_at:         nullableString,
  is_published:         z.boolean().default(false),
  version_count:        z.number().default(0),
  // Backend's real enum (services/organizations/schemas.py VISIBILITY_VALUES)
  // is "private" | "shared" — not "org". The old "org" value here would throw
  // a ZodError on every fetch that includes so much as one shared persona,
  // breaking the whole personas list (sidebar, /agents, search, project panel)
  // for that entire org.
  visibility:           z.enum(['private', 'shared']).default('private'),
  organization_id:      nullableString,
  created_at:           z.string(),
  updated_at:           z.string(),
})

export const personaVersionListItemSchema = z.object({
  id:           z.string(),
  name:         z.string(),
  handler:      z.string(),
  model_id:     nullableString,
  is_active:    z.boolean(),
  version_tags: z.array(z.string()).default([]),
  persona_tags: z.array(z.string()).default([]),
  connectors:   z.array(z.string()).default([]),
  created_at:   z.string(),
  updated_at:   z.string(),
})

export const personaChatsSchema = z.object({
  id:            z.string(),
  chat_title:    z.string(),
  message_count: z.number().default(0),
  persona_id:    nullableString,
  created_at:    z.string(),
  updated_at:    z.string(),
})

export const personaFileAttachmentSchema = z.object({
  file_link: z.string().default(''),
  mime_type: z.string(),
  file_size: z.number(),
  origin:    z.string(),
})

export const personaMessagesSchema = z.object({
  id:               z.string(),
  input:            z.string(),
  output:           z.string(),
  reasoning:        nullableString,
  file_attachments: z.array(personaFileAttachmentSchema).default([]),
  created_at:       z.string(),
  updated_at:       nullableString,
})

export const personaSoundSchema = z.object({
  name:        z.string(),
  description: z.string(),
})

export const personaStarterSchema = z.object({
  system_instruction: z.string(),
  sounds:             z.array(personaSoundSchema).default([]),
  persona_tags:       z.array(z.string()).default([]),
})

export const enhanceOptionSchema = z.object({
  label:       z.string(),
  description: z.string(),
})

export const enhanceQuestionSchema = z.object({
  question:     z.string(),
  options:      z.array(enhanceOptionSchema).default([]),
  multi_select: z.boolean().default(false),
})

export const enhancePromptSchema = z.object({
  enhanced_prompt: z.string(),
  questions:       z.array(enhanceQuestionSchema).default([]),
})

export type PersonaDocumentResponse  = z.infer<typeof personaDocumentSchema>
export type PersonaVersionResponse   = z.infer<typeof personaVersionSchema>
export type PersonaRepoResponse      = z.infer<typeof personaRepoSchema>
export type PersonaVersionListItem   = z.infer<typeof personaVersionListItemSchema>
export type PersonaChatsResponse     = z.infer<typeof personaChatsSchema>
export type PersonaFileAttachment    = z.infer<typeof personaFileAttachmentSchema>
export type GetPersonaMessages       = z.infer<typeof personaMessagesSchema>
export type PersonaSound             = z.infer<typeof personaSoundSchema>
export type PersonaStarterResponse   = z.infer<typeof personaStarterSchema>
export type EnhanceOption            = z.infer<typeof enhanceOptionSchema>
export type EnhanceQuestion          = z.infer<typeof enhanceQuestionSchema>
export type EnhancePromptResponse    = z.infer<typeof enhancePromptSchema>
