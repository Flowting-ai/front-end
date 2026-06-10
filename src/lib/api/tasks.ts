import { apiFetchJson, apiFetch, ApiError } from './client'
import { API_BASE_URL } from '../config'

const withBase = (path: string) => `${API_BASE_URL}${path}`

const TASKS_BASE = withBase('/tasks')
const TASK_BY_ID = (id: string) => withBase(`/tasks/${id}`)
const TASK_RUN   = (id: string) => withBase(`/tasks/${id}/run`)

// ── Schemas (match OpenAPI components.schemas) ────────────────────────────────

export interface ScheduledTaskRunResponse {
  id:            string
  status:        string
  started_at?:   string | null
  completed_at?: string | null
  error?:        string | null
  synthesis?:    string | null
  created_at?:   string | null
}

export interface ScheduledTaskListItem {
  id:             string
  title:          string
  plan_text?:     string
  schedule_json:  Record<string, unknown>
  is_active:      boolean
  next_run_at?:   string | null
  last_run_at?:   string | null
  run_count:      number
  success_count:  number
  failure_count:  number
  success_rate:   number | null
  created_at?:    string | null
  updated_at?:    string | null
}

export interface ScheduledTaskDetail {
  id:             string
  title:          string
  plan_text?:     string
  plan_json:      Record<string, unknown>
  schedule_json:  Record<string, unknown>
  is_active:      boolean
  next_run_at?:   string | null
  last_run_at?:   string | null
  run_count:      number
  success_count:  number
  failure_count:  number
  success_rate:   number | null
  created_at?:    string | null
  updated_at?:    string | null
  runs?:          ScheduledTaskRunResponse[]
}

export interface ScheduledTaskUpdate {
  is_active: boolean
}

// Aliases for back-compat with callers
export type Task       = ScheduledTaskListItem
export type TaskDetail = ScheduledTaskDetail

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /tasks — list user's scheduled tasks. */
export function listTasks(): Promise<ScheduledTaskListItem[]> {
  return apiFetchJson<ScheduledTaskListItem[]>(TASKS_BASE)
}

/** GET /tasks/{task_id} — task + plan + run history. */
export function getTask(taskId: string): Promise<ScheduledTaskDetail> {
  return apiFetchJson<ScheduledTaskDetail>(TASK_BY_ID(taskId))
}

/** PATCH /tasks/{task_id} — pause (is_active=false) or resume (is_active=true). */
export function updateTask(taskId: string, body: ScheduledTaskUpdate): Promise<ScheduledTaskDetail> {
  return apiFetchJson<ScheduledTaskDetail>(TASK_BY_ID(taskId), {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
}

/** POST /tasks/{task_id}/run — trigger an immediate run. */
export async function runTaskNow(taskId: string): Promise<unknown> {
  const response = await apiFetch(TASK_RUN(taskId), { method: 'POST' })
  if (!response.ok) {
    throw new ApiError(response.status, 'task_run_failed', 'Failed to run task')
  }
  try {
    return await response.json()
  } catch {
    return null
  }
}
