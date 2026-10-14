import { z } from 'zod'

/**
 * The custom REST API definition, shared by CustomApiModal (form validation)
 * and createCustomApi (validated again before it is sent), mirroring the
 * backend's request model.
 */

// Same rule as the backend's CredentialName: an HTTP token, never Host.
export const credentialName = z.string().trim().regex(/^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/).refine(v => v.toLowerCase() !== 'host')

export const httpsUrl = z.string().trim().url().startsWith('https://')

export const customApiSchema = z.object({
  name:     z.string().trim().min(1).max(128),
  base_url: httpsUrl,
  auth:     z.discriminatedUnion('type', [
    z.object({ type: z.literal('bearer') }),
    z.object({ type: z.literal('header'), name: credentialName }),
    z.object({ type: z.literal('query'), name: credentialName }),
    z.object({ type: z.literal('basic') }),
  ]),
  docs_url: z.string().trim().url().optional(),
})

// What the link call files, keyed by the backend's api_key field names.
export const customApiCredentialsSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('basic'), username: z.string().trim().min(1), password: z.string().min(1) }),
  z.object({ type: z.enum(['bearer', 'header', 'query']), token: z.string().trim().min(1) }),
])

export type CustomApiDefinition = z.infer<typeof customApiSchema>
