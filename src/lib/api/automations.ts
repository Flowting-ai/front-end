import { apiFetchJson, apiFetch, ApiError } from './client'
import { API_BASE_URL } from '../config'
import { parseList } from './project-schemas'
import {
  automationCopySchema,
  automationDeleteSchema,
  automationDetailSchema,
  automationSchema,
  organizationAutomationSchema,
  type Automation,
  type AutomationCopy,
  type AutomationDeleteResponse,
  type AutomationDetail,
  type AutomationRun,
  type OrganizationAutomation,
} from './automation-schemas'

export type {
  Automation,
  AutomationConnector,
  AutomationCopy,
  AutomationDeleteResponse,
  AutomationDetail,
  AutomationRun,
  OrganizationAutomation,
  ScheduleJson,
} from './automation-schemas'

const withBase = (path: string) => `${API_BASE_URL}${path}`

const AUTOMATIONS_BASE = withBase('/automations')
const AUTOMATION_BY_ID = (id: string) => withBase(`/automations/${encodeURIComponent(id)}`)
const AUTOMATION_RUN   = (id: string) => withBase(`/automations/${encodeURIComponent(id)}/run`)
const AUTOMATION_COPY  = (id: string) => withBase(`/automations/${encodeURIComponent(id)}/copy`)
const ORGANIZATION_AUTOMATIONS = withBase('/automations/organization')

// Response shapes live in ./automation-schemas (Zod, mirrors the backend).

export interface AutomationUpdate {
  is_active?: boolean
  name?:      string
  summary?:   string
}

/** What a finished run has to say for itself: its answer, or why it failed.
 *  A run that failed inside a sandbox script carries the whole Python traceback
 *  in `error` — every line above the last is our own call stack, which nobody
 *  reading a run history can act on. */
export function runSummary(run: AutomationRun): string {
  if (run.answer) return run.answer
  if (run.status === 'failed') return failureReason(run.error ?? '')
  if (run.status === 'running') return 'Still running.'
  if (run.status === 'interrupted') return 'Stopped by a Souvenir restart before it finished. It does not count as a failure.'
  return 'This run finished without an answer.'
}

/** The last line of a traceback — the exception and its message — with the
 *  module-qualified class name dropped. */
export function failureReason(error: string): string {
  const lines = error.split('\n').map(line => line.trim()).filter(Boolean)
  const last  = lines[lines.length - 1] ?? ''
  const message = last.replace(/^[A-Za-z_][\w.]*(?:Error|Exception|Interrupt|Timeout|Failure):\s*/, '')
  return message || last.replace(/:$/, '') || 'The run failed without saying why.'
}

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /automations — list the user's automations. Malformed rows are dropped. */
export async function listAutomations(): Promise<Automation[]> {
  return parseList(automationSchema, await apiFetchJson<unknown>(AUTOMATIONS_BASE), 'automation')
}

/** GET /automations/organization — everyone else's live automations in the user's org. */
export async function listOrganizationAutomations(): Promise<OrganizationAutomation[]> {
  return parseList(
    organizationAutomationSchema,
    await apiFetchJson<unknown>(ORGANIZATION_AUTOMATIONS),
    'organization automation',
  )
}

/** POST /automations/{id}/copy — open a chat that rebuilds it as the user's own. */
export async function copyAutomation(id: string): Promise<AutomationCopy> {
  return automationCopySchema.parse(await apiFetchJson<unknown>(AUTOMATION_COPY(id), { method: 'POST' }))
}

/** GET /automations/{id} — the automation plus its run history. */
export async function getAutomation(id: string): Promise<AutomationDetail> {
  return automationDetailSchema.parse(await apiFetchJson<unknown>(AUTOMATION_BY_ID(id)))
}

/** PATCH /automations/{id} — pause/resume, rename, or rewrite the summary. */
export async function updateAutomation(id: string, body: AutomationUpdate): Promise<AutomationDetail> {
  return automationDetailSchema.parse(await apiFetchJson<unknown>(AUTOMATION_BY_ID(id), {
    method: 'PATCH',
    body:   JSON.stringify(body),
  }))
}

/** DELETE /automations/{id} — drop the trigger and retire it. Runs are kept. */
export async function deleteAutomation(id: string): Promise<AutomationDeleteResponse> {
  return automationDeleteSchema.parse(await apiFetchJson<unknown>(AUTOMATION_BY_ID(id), { method: 'DELETE' }))
}

/** POST /automations/{id}/run — fire it once, now. */
export async function runAutomationNow(id: string): Promise<unknown> {
  const response = await apiFetch(AUTOMATION_RUN(id), { method: 'POST' })
  if (!response.ok) {
    throw new ApiError(response.status, 'automation_run_failed', 'Failed to run automation')
  }
  try {
    return await response.json()
  } catch {
    return null
  }
}
