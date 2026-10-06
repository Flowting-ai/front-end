import { z } from 'zod'

// Wire schemas for GET /connectors as ds-dev serializes them
// (services/connectors/schemas.py, verified against
// https://devapi.getsouvenir.com/openapi.json). Snake_case, exact field
// names, only the defaults the backend itself declares.

export const accountScopeSchema = z.enum(['personal', 'shared'])
export const accountStatusSchema = z.enum(['active', 'disabled', 'expired'])
export const toolPermissionSchema = z.enum(['allowed', 'blocked', 'ask'])

// The catalog describes each tool once. Decisions live on the account, in
// ConnectionResponse.permissions, joined back by key.
export const toolEntrySchema = z.object({
  key:         z.string(),
  name:        z.string().default(''),
  description: z.string().default(''),
  read_only:   z.boolean().nullable().default(null),
})

export const toolPermissionEntrySchema = z.object({
  key:        z.string(),
  permission: toolPermissionSchema.default('ask'),
})

export const connectionResponseSchema = z.object({
  id:                  z.string(),
  nickname:            z.string(),
  scope:               accountScopeSchema,
  connector_slug:      z.string(),
  account_identifier:  z.string().nullable().default(null),
  connected:           z.boolean(),
  status:              accountStatusSchema.default('active'),
  version:             z.number().int().default(1),
  // The person who linked it. `owned` is false when it was shared with you:
  // usable, but only the owner can change or unlink it.
  owner_id:            z.string(),
  owned:               z.boolean(),
  // Sparse — a tool with no entry is 'ask'.
  permissions:         z.array(toolPermissionEntrySchema).default([]),
  created_at:          z.string(),
  updated_at:          z.string(),
})

export const apiKeyFieldSchema = z.object({
  name:     z.string(),
  label:    z.string(),
  help:     z.string().default(''),
  secret:   z.boolean().default(false),
  required: z.boolean().default(true),
})

export const catalogMetadataSchema = z.looseObject({
  id:                 z.string().optional(),
  name_slug:          z.string().optional(),
  name:               z.string().optional(),
  img_src:            z.string().nullish(),
  description:        z.string().optional(),
  auth_type:          z.string().nullish(),
  custom_fields_json: z.string().nullish(),
  categories:         z.array(z.string()).optional(),
  featured_weight:    z.number().nullish(),
})

export const connectorCatalogEntrySchema = z.object({
  slug:             z.string(),
  display_name:     z.string(),
  auth_mode:        z.enum(['oauth2', 'api_key']),
  provider:         z.string(),
  description:      z.string(),
  logo_url:         z.string().nullable().default(null),
  categories:       z.array(z.string()).default([]),
  catalog_metadata: catalogMetadataSchema.default({}),
  tools:            z.array(toolEntrySchema).default([]),
  api_key_fields:   z.array(apiKeyFieldSchema).default([]),
  linked:           z.boolean(),
  connections:      z.array(connectionResponseSchema).default([]),
})

export const connectorListResponseSchema = z.object({
  connectors:  z.array(connectorCatalogEntrySchema).default([]),
  next_cursor: z.string().nullable().default(null),
  has_more:    z.boolean().default(false),
})

export const linkResponseSchema = z.object({
  connector_slug: z.string(),
  redirect_url:   z.string().nullable().default(null),
})

export type ToolEntryWire = z.infer<typeof toolEntrySchema>
export type ToolPermissionEntryWire = z.infer<typeof toolPermissionEntrySchema>
export type ConnectionResponseWire = z.infer<typeof connectionResponseSchema>
export type ApiKeyField = z.infer<typeof apiKeyFieldSchema>
export type ConnectorCatalogMetadata = z.infer<typeof catalogMetadataSchema>
export type ConnectorCatalogEntryWire = z.infer<typeof connectorCatalogEntrySchema>
export type LinkResponseWire = z.infer<typeof linkResponseSchema>
export type ConnectorToolPermission = z.infer<typeof toolPermissionSchema>
export type ConnectorAccountScope = z.infer<typeof accountScopeSchema>
export type ConnectorAccountStatus = z.infer<typeof accountStatusSchema>
