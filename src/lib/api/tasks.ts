import { apiFetchJson, apiFetch, ApiError } from './client'
import { API_BASE_URL } from '../config'

const withBase = (path: string) => `${API_BASE_URL}${path}`

const TASKS_BASE = withBase('/tasks')
const TASK_BY_ID = (id: string) => withBase(`/tasks/${id}`)
const TASK_RUN   = (id: string) => withBase(`/tasks/${id}/run`)

// ── Backend types ─────────────────────────────────────────────────────────────

export interface Task {
  id:            string
  title:         string
  plan_text:     string
  schedule_json: Record<string, unknown>
  is_active:     boolean
  next_run_at:   string | null
  last_run_at:   string | null
  run_count:     number
  created_at:    string
  updated_at:    string
}

export interface TaskDetail extends Task {
  plan_json: Record<string, unknown>
  runs:      unknown[]
}

// ── API functions ─────────────────────────────────────────────────────────────

export function listTasks(): Promise<Task[]> {
  return apiFetchJson<Task[]>(TASKS_BASE)
}

export function getTask(taskId: string): Promise<TaskDetail> {
  return apiFetchJson<TaskDetail>(TASK_BY_ID(taskId))
}

export async function runTaskNow(taskId: string): Promise<string> {
  const response = await apiFetch(TASK_RUN(taskId), { method: 'POST' })
  if (!response.ok) {
    throw new ApiError(response.status, 'task_run_failed', 'Failed to run task')
  }
  return response.json() as Promise<string>
}
