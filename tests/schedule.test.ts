import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getRepeatingTaskProposals,
  getDueDateProposals,
  isScheduleDueOnDate,
  normalizeRepeatSchedule,
  normalizeWeekdays
} from '../src/shared/schedule'
import { buildQuickAddSchedule } from '../src/shared/quick-add'

test('normalizeWeekdays keeps JS weekday range and converts legacy sunday=7', () => {
  assert.deepEqual(normalizeWeekdays([7, 1, 0, 8], [1]), [1, 0])
})

test('Quick Add weekdays always maps to Monday-Friday', () => {
  const schedule = buildQuickAddSchedule({
    scheduleType: 'weekdays',
    weekdays: [6, 0],
    intervalDays: 3,
    monthlyDay: 1,
    afterDoneDays: 1
  })
  assert.deepEqual(schedule, { type: 'weekdays', days: [1, 2, 3, 4, 5] })
})

test('legacy sunday value is normalized and due on Sunday', () => {
  const sunday = new Date(2026, 0, 11, 12, 0, 0)
  const monday = new Date(2026, 0, 12, 12, 0, 0)
  const normalized = normalizeRepeatSchedule({ type: 'weekdays', days: [7] as number[] })
  assert.deepEqual(normalized.days, [0])
  assert.equal(isScheduleDueOnDate(normalized, '2026-01-01T00:00:00.000Z', null, sunday), true)
  assert.equal(isScheduleDueOnDate(normalized, '2026-01-01T00:00:00.000Z', null, monday), false)
})

test('proposals respect startDate/endDate and completion filters', () => {
  const date = new Date(2026, 0, 12, 12, 0, 0)
  const repeatingTasks = [
    {
      id: 'active',
      order: 0,
      schedule: { type: 'daily' as const },
      createdAt: '2026-01-01T00:00:00.000Z',
      lastCompletedAt: null,
      startDate: '2026-01-10',
      endDate: '2026-01-20'
    },
    {
      id: 'future',
      order: 1,
      schedule: { type: 'daily' as const },
      createdAt: '2026-01-01T00:00:00.000Z',
      lastCompletedAt: null,
      startDate: '2026-01-13',
      endDate: null
    },
    {
      id: 'expired',
      order: 2,
      schedule: { type: 'daily' as const },
      createdAt: '2026-01-01T00:00:00.000Z',
      lastCompletedAt: null,
      startDate: null,
      endDate: '2026-01-11'
    }
  ]

  const quickTasks = [
    {
      repeatingTaskId: 'active',
      completed: true,
      completedAt: '2026-01-12T08:00:00.000Z'
    }
  ]

  const proposals = getRepeatingTaskProposals({
    repeatingTasks,
    quickTasks,
    dismissedRepeating: {},
    date
  })

  assert.equal(proposals.length, 0)
})

test('monthly schedules are evaluated consistently', () => {
  const monthlyDayDate = new Date(2026, 2, 15, 12, 0, 0)
  assert.equal(
    isScheduleDueOnDate({ type: 'monthlyDay', day: 15 }, '2026-01-01T00:00:00.000Z', null, monthlyDayDate),
    true
  )

  const secondTuesday = new Date(2026, 0, 13, 12, 0, 0)
  assert.equal(
    isScheduleDueOnDate(
      { type: 'monthlyNthWeekday', week: 2, weekday: 2 },
      '2026-01-01T00:00:00.000Z',
      null,
      secondTuesday
    ),
    true
  )

  const everyTwoMonths = new Date(2026, 2, 10, 12, 0, 0)
  assert.equal(
    isScheduleDueOnDate(
      { type: 'everyNMonths', months: 2, day: 10 },
      '2026-01-10T00:00:00.000Z',
      null,
      everyTwoMonths
    ),
    true
  )
})

test('monthlyLastDay is due on last day of each month', () => {
  const schedule = { type: 'monthlyLastDay' as const }
  const created = '2026-01-01T00:00:00.000Z'

  // Jan 31
  assert.equal(isScheduleDueOnDate(schedule, created, null, new Date(2026, 0, 31, 12, 0, 0)), true)
  assert.equal(isScheduleDueOnDate(schedule, created, null, new Date(2026, 0, 30, 12, 0, 0)), false)

  // Feb 28 (non-leap)
  assert.equal(isScheduleDueOnDate(schedule, created, null, new Date(2026, 1, 28, 12, 0, 0)), true)
  assert.equal(isScheduleDueOnDate(schedule, created, null, new Date(2026, 1, 27, 12, 0, 0)), false)

  // Feb 29 (leap year 2028)
  assert.equal(isScheduleDueOnDate(schedule, created, null, new Date(2028, 1, 29, 12, 0, 0)), true)
  assert.equal(isScheduleDueOnDate(schedule, created, null, new Date(2028, 1, 28, 12, 0, 0)), false)

  // Apr 30
  assert.equal(isScheduleDueOnDate(schedule, created, null, new Date(2026, 3, 30, 12, 0, 0)), true)
  assert.equal(isScheduleDueOnDate(schedule, created, null, new Date(2026, 3, 29, 12, 0, 0)), false)
})

test('Quick Add lastDay maps to monthlyLastDay', () => {
  const schedule = buildQuickAddSchedule({
    scheduleType: 'lastDay',
    weekdays: [],
    intervalDays: 1,
    monthlyDay: 1,
    afterDoneDays: 1
  })
  assert.deepEqual(schedule, { type: 'monthlyLastDay' })
})

// --- getDueDateProposals ---

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'Project',
    archivedAt: null,
    suspendedAt: null,
    tasks: [],
    ...overrides
  }
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    completed: false,
    isToDoNext: false,
    someday: false,
    dueDate: null,
    ...overrides
  }
}

test('getDueDateProposals returns tasks due on the given date', () => {
  const date = new Date(2026, 0, 15, 12, 0, 0) // 2026-01-15
  const projects = [makeProject({ tasks: [makeTask({ dueDate: '2026-01-15' })] })]
  const result = getDueDateProposals({ projects, date })
  assert.equal(result.length, 1)
  assert.equal(result[0].task.id, 't1')
  assert.equal(result[0].project.id, 'p1')
})

test('getDueDateProposals excludes tasks with non-matching dueDate', () => {
  const date = new Date(2026, 0, 15, 12, 0, 0)
  const projects = [makeProject({ tasks: [makeTask({ dueDate: '2026-01-16' })] })]
  const result = getDueDateProposals({ projects, date })
  assert.equal(result.length, 0)
})

test('getDueDateProposals excludes completed tasks', () => {
  const date = new Date(2026, 0, 15, 12, 0, 0)
  const projects = [makeProject({ tasks: [makeTask({ dueDate: '2026-01-15', completed: true })] })]
  const result = getDueDateProposals({ projects, date })
  assert.equal(result.length, 0)
})

test('getDueDateProposals excludes tasks already pinned (isToDoNext)', () => {
  const date = new Date(2026, 0, 15, 12, 0, 0)
  const projects = [makeProject({ tasks: [makeTask({ dueDate: '2026-01-15', isToDoNext: true })] })]
  const result = getDueDateProposals({ projects, date })
  assert.equal(result.length, 0)
})

test('getDueDateProposals excludes someday tasks', () => {
  const date = new Date(2026, 0, 15, 12, 0, 0)
  const projects = [makeProject({ tasks: [makeTask({ dueDate: '2026-01-15', someday: true })] })]
  const result = getDueDateProposals({ projects, date })
  assert.equal(result.length, 0)
})

test('getDueDateProposals excludes archived and suspended projects', () => {
  const date = new Date(2026, 0, 15, 12, 0, 0)
  const archived = makeProject({ id: 'pa', archivedAt: '2026-01-01', tasks: [makeTask({ id: 'ta', dueDate: '2026-01-15' })] })
  const suspended = makeProject({ id: 'ps', suspendedAt: '2026-01-01', tasks: [makeTask({ id: 'ts', dueDate: '2026-01-15' })] })
  const result = getDueDateProposals({ projects: [archived, suspended], date })
  assert.equal(result.length, 0)
})

test('getDueDateProposals excludes tasks with null/undefined dueDate', () => {
  const date = new Date(2026, 0, 15, 12, 0, 0)
  const projects = [makeProject({ tasks: [makeTask({ dueDate: null }), makeTask({ id: 't2' })] })]
  const result = getDueDateProposals({ projects, date })
  assert.equal(result.length, 0)
})
