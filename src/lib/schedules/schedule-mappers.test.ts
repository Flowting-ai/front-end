import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/client'
import { failureReason } from '@/lib/api/automations'
import {
  automationDetailSchema,
  automationSchema,
  organizationAutomationSchema,
} from '@/lib/api/automation-schemas'
import { parseList } from '@/lib/api/project-schemas'
import {
  detailFailureKind,
  formatNextRun,
  formatRunTime,
  organizationToListItem,
  runToRecord,
  scheduleDescription,
  scheduleDrift,
  taskDetailToDetail,
  taskToListItem,
} from './schedule-mappers'

const NOW = new Date(2026, 9, 14, 12, 0)
const BASE = {
  id: 'a1',
  name: 'Daily digest',
  summary: 'Sum up Slack',
  schedule_json: { description: 'Every day at 9:00 AM (UTC)', cron: '0 9 * * *', timezone: 'UTC' },
  trigger: { kind: 'schedule' },
  is_active: true,
  status: 'active',
  run_count: 3,
  success_count: 2,
  failure_count: 1,
  running_count: 0,
  is_running: false,
  success_rate: 0.6667,
  created_at: '2026-10-01T09:00:00Z',
}

describe('automation schemas', () => {
  it('fills backend defaults and keeps unknown schedule keys', () => {
    const parsed = automationSchema.parse({ id: 'x', name: 'n', is_active: false, schedule_json: { kind: 'once', at: 'z' } })
    expect(parsed.summary).toBe('')
    expect(parsed.run_count).toBe(0)
    expect(parsed.success_rate).toBeNull()
    expect(parsed.schedule_json).toEqual({ kind: 'once', at: 'z' })
  })

  it('drops malformed list rows', () => {
    expect(parseList(automationSchema, [BASE, { id: 'bad' }], 'automation')).toHaveLength(1)
    expect(() => parseList(automationSchema, { error: 'x' }, 'automation')).toThrow()
  })

  it('parses detail runs and org connectors', () => {
    const detail = automationDetailSchema.parse({ ...BASE, runs: [{ id: 'r', status: 'failed', answer: null, error: 'X' }] })
    expect(detail.runs[0].answer).toBe('')
    const org = organizationAutomationSchema.parse({ ...BASE, owner_name: 'Sam', connectors: [{ slug: 's', display_name: 'Slack' }] })
    expect(org.connectors[0].logo_url).toBeNull()
  })
})

describe('schedule mappers', () => {
  it('reads description and drift', () => {
    expect(scheduleDescription({})).toBe('On a schedule')
    expect(scheduleDescription({ description: 'Every 5 minutes' })).toBe('Every 5 minutes')
    expect(scheduleDrift({ drift: true })).toBe(true)
    expect(scheduleDrift({})).toBe(false)
  })

  it('formats relative run times and tolerates bad dates', () => {
    expect(formatNextRun(new Date(2026, 9, 15, 9, 0).toISOString(), NOW)).toBe('Tomorrow · 9:00 AM')
    expect(formatRunTime(new Date(2026, 9, 13, 9, 0).toISOString(), NOW)).toBe('Yesterday · 9:00 AM')
    expect(formatRunTime(new Date(2025, 0, 2, 9, 0).toISOString(), NOW)).toBe('Jan 2, 2025 · 9:00 AM')
    expect(formatNextRun('garbage', NOW)).toBeUndefined()
  })

  it('maps a list row', () => {
    const item = taskToListItem(automationSchema.parse(BASE), 'chat-1')
    expect(item).toMatchObject({ id: 'a1', frequency: 'Every day at 9:00 AM (UTC)', chatId: 'chat-1', drift: false })
  })

  it('prefers the backend chat id in detail', () => {
    const detail = automationDetailSchema.parse({ ...BASE, chat_id: 'server-chat' })
    expect(taskDetailToDetail(detail, 'local-chat', NOW).chatId).toBe('server-chat')
    const noChat = automationDetailSchema.parse(BASE)
    expect(taskDetailToDetail(noChat, 'local-chat', NOW).chatId).toBe('local-chat')
  })

  it('maps runs to records', () => {
    const failed = runToRecord({ id: 'r', status: 'failed', answer: '', error: 'Traceback\nValueError: bad input' }, NOW)
    expect(failed).toMatchObject({ title: 'Failed', status: 'failed', summary: 'bad input', label: 'Run' })
    expect(failed.detail).toContain('Traceback')
    expect(runToRecord({ id: 'r', status: 'running', answer: '' }, NOW).status).toBe('executing')
  })

  it('maps org rows with connectors', () => {
    const row = organizationAutomationSchema.parse({ ...BASE, owner_name: 'Sam', connectors: [{ slug: 's', display_name: 'Slack', logo_url: 'u' }] })
    expect(organizationToListItem(row)).toMatchObject({ ownerName: 'Sam', connectors: [{ slug: 's', name: 'Slack', logoUrl: 'u' }] })
  })

  it('failureReason keeps the last traceback line', () => {
    expect(failureReason('a\nmod.KeyError: missing')).toBe('missing')
    expect(failureReason('')).toBe('The run failed without saying why.')
  })
})

describe('detailFailureKind', () => {
  it.each([
    [new ApiError(403, 'forbidden', 'no'), 'try_organization'],
    [new ApiError(404, 'not_found', 'no'), 'try_organization'],
    [new ApiError(500, 'server', 'boom'), 'retry'],
    [new TypeError('fetch failed'), 'retry'],
  ])('%s → %s', (error, kind) => {
    expect(detailFailureKind(error)).toBe(kind)
  })
})
