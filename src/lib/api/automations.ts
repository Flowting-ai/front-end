import { apiFetchJson, apiFetch, ApiError } from './client'
import { API_BASE_URL } from '../config'

const withBase = (path: string) => `${API_BASE_URL}${path}`

const AUTOMATIONS_BASE = withBase('/automations')
const AUTOMATION_BY_ID = (id: string) => withBase(`/automations/${id}`)
const AUTOMATION_RUN   = (id: string) => withBase(`/automations/${id}/run`)

// ── Schemas (match OpenAPI components.schemas) ────────────────────────────────

export interface AutomationRun {
  id:           string
  status:       string          // running | succeeded | failed
  started_at?:  string | null
  finished_at?: string | null
  answer:       string
  error?:       string | null
}

export interface Automation {
  id:             string
  name:           string
  summary:        string        // what it does each run, in the user's words
  schedule_json:  Record<string, unknown>
  trigger:        Record<string, unknown>
  is_active:      boolean
  next_run_at?:   string | null
  last_run_at?:   string | null
  run_count:      number
  success_count:  number
  failure_count:  number
  running_count:  number
  is_running:     boolean
  success_rate:   number | null
  created_at?:    string | null
  updated_at?:    string | null
}

export interface AutomationDetail extends Automation {
  chat_id?: string | null
  runs?:    AutomationRun[]
}

export interface AutomationUpdate {
  is_active?: boolean
  name?:      string
  summary?:   string
}

export interface AutomationDeleteResponse {
  deleted:       boolean
  automation_id: string
}

/** What a finished run has to say for itself: its answer, or why it failed.
 *  A run that failed inside a sandbox script carries the whole Python traceback
 *  in `error` — every line above the last is our own call stack, which nobody
 *  reading a run history can act on. */
export function runSummary(run: AutomationRun): string {
  if (run.answer) return run.answer
  if (run.status === 'failed') return failureReason(run.error ?? '')
  if (run.status === 'running') return 'Still running.'
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

/** GET /automations — list the user's automations. */
export function listAutomations(): Promise<Automation[]> {
  return apiFetchJson<Automation[]>(AUTOMATIONS_BASE)
}

/** GET /automations/{id} — the automation plus its run history. */
export function getAutomation(id: string): Promise<AutomationDetail> {
  return apiFetchJson<AutomationDetail>(AUTOMATION_BY_ID(id))
}

/** PATCH /automations/{id} — pause/resume, rename, or rewrite the summary. */
export function updateAutomation(id: string, body: AutomationUpdate): Promise<AutomationDetail> {
  return apiFetchJson<AutomationDetail>(AUTOMATION_BY_ID(id), {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
}

/** DELETE /automations/{id} — drop the trigger and retire it. Runs are kept. */
export function deleteAutomation(id: string): Promise<AutomationDeleteResponse> {
  return apiFetchJson<AutomationDeleteResponse>(AUTOMATION_BY_ID(id), { method: 'DELETE' })
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
