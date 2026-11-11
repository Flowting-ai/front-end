import { z } from 'zod'

// Mirrors back-end services/automations/schemas.py. Optional fields get the
// backend's defaults, so a dropped field degrades instead of crashing; a
// missing id/name/is_active fails the parse (and the row, in a list).

/**
 * What services/automations/schedule.py :: scheduleJson builds. `description`
 * is the sentence the UI shows; `drift` flags a deployed timer that disagrees
 * with what is stored. Other keys (cron, timezone, kind, …) pass through.
 */
export const scheduleJsonSchema = z.looseObject({
  description: z.string().optional(),
  drift:       z.boolean().optional(),
  kind:        z.string().optional(),
  cron:        z.string().optional(),
  timezone:    z.string().optional(),
})

export const automationRunSchema = z.object({
  id:          z.string(),
  status:      z.string(),
  started_at:  z.string().nullish(),
  finished_at: z.string().nullish(),
  answer:      z.string().nullish().transform(v => v ?? ''),
  error:       z.string().nullish(),
})

const count = z.number().nullish().transform(v => v ?? 0)

export const automationSchema = z.object({
  id:            z.string(),
  name:          z.string(),
  summary:       z.string().nullish().transform(v => v ?? ''),
  schedule_json: scheduleJsonSchema.nullish().transform(v => v ?? {}),
  trigger:       z.record(z.string(), z.unknown()).nullish().transform(v => v ?? {}),
  is_active:     z.boolean(),
  next_run_at:   z.string().nullish(),
  last_run_at:   z.string().nullish(),
  run_count:     count,
  success_count: count,
  failure_count: count,
  running_count: count,
  is_running:    z.boolean().nullish().transform(v => v ?? false),
  success_rate:  z.number().nullish().transform(v => v ?? null),
  created_at:    z.string().nullish(),
  updated_at:    z.string().nullish(),
})

export const automationDetailSchema = automationSchema.extend({
  chat_id: z.string().nullish(),
  runs:    z.array(automationRunSchema).nullish().transform(v => v ?? []),
})

export const automationConnectorSchema = z.object({
  slug:         z.string(),
  display_name: z.string(),
  logo_url:     z.string().nullish().transform(v => v ?? null),
})

export const organizationAutomationSchema = automationSchema.extend({
  owner_name: z.string(),
  connectors: z.array(automationConnectorSchema).nullish().transform(v => v ?? []),
})

export const automationCopySchema = z.object({
  chat_id: z.string(),
  prompt:  z.string(),
})

export const automationDeleteSchema = z.object({
  deleted:       z.boolean(),
  automation_id: z.string(),
})

export type ScheduleJson = z.infer<typeof scheduleJsonSchema>
export type AutomationRun = z.infer<typeof automationRunSchema>
export type Automation = z.infer<typeof automationSchema>
export type AutomationDetail = z.infer<typeof automationDetailSchema>
export type AutomationConnector = z.infer<typeof automationConnectorSchema>
export type OrganizationAutomation = z.infer<typeof organizationAutomationSchema>
export type AutomationCopy = z.infer<typeof automationCopySchema>
export type AutomationDeleteResponse = z.infer<typeof automationDeleteSchema>
