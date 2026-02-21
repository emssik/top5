import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getRepeatingTaskProposals,
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
