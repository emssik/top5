import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isScheduledOn,
  dayStatus,
  computeStreak,
  weeklyProgress,
  scheduleLabel,
  HABIT_ICONS,
  DEFAULT_FREEZE_AVAILABLE
} from '../src/shared/habit-schedule'
import type { Habit } from '../src/shared/types'

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Test',
    icon: 'flame',
    note: '',
    createdAt: '2026-01-01',
    freezeAvailable: DEFAULT_FREEZE_AVAILABLE,
    order: 0,
    schedule: { type: 'daily' },
    log: {},
    ...overrides
  }
}

// --- isScheduledOn ---

test('isScheduledOn: daily always true', () => {
  const h = makeHabit({ schedule: { type: 'daily' } })
  assert.equal(isScheduledOn(h, new Date('2026-04-20')), true)
  assert.equal(isScheduledOn(h, new Date('2026-01-01')), true)
})

test('isScheduledOn: weekdays matches correct days (0=Sun..6=Sat)', () => {
  // Monday=1, Wednesday=3
  const h = makeHabit({ schedule: { type: 'weekdays', days: [1, 3] } })
  const monday = new Date('2026-04-20') // Monday
  const wednesday = new Date('2026-04-22') // Wednesday
  const tuesday = new Date('2026-04-21') // Tuesday
  const sunday = new Date('2026-04-19') // Sunday
  assert.equal(isScheduledOn(h, monday), true)
  assert.equal(isScheduledOn(h, wednesday), true)
  assert.equal(isScheduledOn(h, tuesday), false)
  assert.equal(isScheduledOn(h, sunday), false)
})

test('isScheduledOn: interval every 3 days from createdAt', () => {
  const h = makeHabit({
    createdAt: '2026-01-01',
    schedule: { type: 'interval', every: 3 }
  })
  // day 0 = 2026-01-01 -> true
  assert.equal(isScheduledOn(h, new Date('2026-01-01')), true)
  // day 3 = 2026-01-04 -> true
  assert.equal(isScheduledOn(h, new Date('2026-01-04')), true)
  // day 1 = 2026-01-02 -> false
  assert.equal(isScheduledOn(h, new Date('2026-01-02')), false)
  // day 6 = 2026-01-07 -> true
  assert.equal(isScheduledOn(h, new Date('2026-01-07')), true)
})

test('isScheduledOn: nPerWeek always true', () => {
  const h = makeHabit({ schedule: { type: 'nPerWeek', count: 3 } })
  assert.equal(isScheduledOn(h, new Date('2026-04-20')), true)
  assert.equal(isScheduledOn(h, new Date('2026-04-21')), true)
})

test('isScheduledOn: dailyMinutes always true', () => {
  const h = makeHabit({ schedule: { type: 'dailyMinutes', minutes: 10 } })
  assert.equal(isScheduledOn(h, new Date('2026-04-20')), true)
})

test('isScheduledOn: weeklyMinutes always true', () => {
  const h = makeHabit({ schedule: { type: 'weeklyMinutes', minutes: 180 } })
  assert.equal(isScheduledOn(h, new Date('2026-04-20')), true)
})

// --- dayStatus ---

test('dayStatus: empty when no entry', () => {
  const h = makeHabit({ log: {} })
  assert.equal(dayStatus(h, '2026-04-20'), 'empty')
})

test('dayStatus: freeze', () => {
  const h = makeHabit({ log: { '2026-04-20': { freeze: true } } })
  assert.equal(dayStatus(h, '2026-04-20'), 'freeze')
})

test('dayStatus: skip', () => {
  const h = makeHabit({ log: { '2026-04-20': { skip: true } } })
  assert.equal(dayStatus(h, '2026-04-20'), 'skip')
})

test('dayStatus: done without minutes -> l3', () => {
  const h = makeHabit({ log: { '2026-04-20': { done: true } } })
  assert.equal(dayStatus(h, '2026-04-20'), 'l3')
})

test('dayStatus: dailyMinutes pct levels', () => {
  const h = makeHabit({ schedule: { type: 'dailyMinutes', minutes: 10 } })
  // pct 0.5 -> l1
  const h1 = { ...h, log: { '2026-04-20': { done: true, minutes: 5 } } }
  assert.equal(dayStatus(h1, '2026-04-20'), 'l1')
  // pct 1.0 -> l2
  const h2 = { ...h, log: { '2026-04-20': { done: true, minutes: 10 } } }
  assert.equal(dayStatus(h2, '2026-04-20'), 'l2')
  // pct 1.2 -> l3
  const h3 = { ...h, log: { '2026-04-20': { done: true, minutes: 12 } } }
  assert.equal(dayStatus(h3, '2026-04-20'), 'l3')
  // pct 1.5 -> l4
  const h4 = { ...h, log: { '2026-04-20': { done: true, minutes: 15 } } }
  assert.equal(dayStatus(h4, '2026-04-20'), 'l4')
})

// --- computeStreak: daily ---

test('computeStreak: daily empty log streak=0', () => {
  const today = new Date('2026-04-20')
  const h = makeHabit({ createdAt: '2026-04-18', schedule: { type: 'daily' } })
  const result = computeStreak(h, today)
  assert.equal(result.streak, 0)
  assert.equal(result.unit, 'dni')
})

test('computeStreak: daily full chain streak=3', () => {
  const today = new Date('2026-04-20')
  const h = makeHabit({
    createdAt: '2026-04-18',
    schedule: { type: 'daily' },
    log: {
      '2026-04-18': { done: true },
      '2026-04-19': { done: true },
      '2026-04-20': { done: true }
    }
  })
  const result = computeStreak(h, today)
  assert.equal(result.streak, 3)
  assert.equal(result.best, 3)
})

test('computeStreak: daily chain broken by empty resets streak', () => {
  const today = new Date('2026-04-20')
  const h = makeHabit({
    createdAt: '2026-04-17',
    schedule: { type: 'daily' },
    log: {
      '2026-04-17': { done: true },
      '2026-04-18': { done: true },
      // 2026-04-19 empty -> resets
      '2026-04-20': { done: true }
    }
  })
  const result = computeStreak(h, today)
  assert.equal(result.streak, 1)
  assert.equal(result.best, 2)
})

test('computeStreak: daily freeze saves chain (not empty)', () => {
  const today = new Date('2026-04-20')
  const h = makeHabit({
    createdAt: '2026-04-18',
    schedule: { type: 'daily' },
    log: {
      '2026-04-18': { done: true },
      '2026-04-19': { freeze: true }, // freeze = not empty, saves chain
      '2026-04-20': { done: true }
    }
  })
  const result = computeStreak(h, today)
  assert.equal(result.streak, 3)
})

// --- computeStreak: weekdays ---

test('computeStreak: weekdays off-days do not reset streak', () => {
  // Mon=1, Wed=3, Fri=5
  const today = new Date('2026-04-22') // Wednesday
  const h = makeHabit({
    createdAt: '2026-04-20', // Monday
    schedule: { type: 'weekdays', days: [1, 3] },
    log: {
      '2026-04-20': { done: true }, // Monday - scheduled
      // 2026-04-21 Tuesday - NOT scheduled, skip
      '2026-04-22': { done: true }  // Wednesday - scheduled
    }
  })
  const result = computeStreak(h, today)
  assert.equal(result.streak, 2)
  assert.equal(result.unit, 'dni')
})

// --- computeStreak: interval ---

test('computeStreak: interval(3) miss on scheduled day resets streak', () => {
  const today = new Date('2026-01-07')
  const h = makeHabit({
    createdAt: '2026-01-01',
    schedule: { type: 'interval', every: 3 },
    log: {
      '2026-01-01': { done: true }, // day 0 - scheduled
      // 2026-01-04 day 3 - scheduled, MISSED
    }
  })
  const result = computeStreak(h, today)
  assert.equal(result.streak, 0)
  assert.equal(result.best, 1)
})

// --- computeStreak: nPerWeek ---

test('computeStreak: nPerWeek(3) week with 3 done increments week streak', () => {
  // Week Mon 2026-04-13 to Sun 2026-04-19
  const today = new Date('2026-04-20') // next week Monday
  const h = makeHabit({
    createdAt: '2026-04-13',
    schedule: { type: 'nPerWeek', count: 3 },
    log: {
      '2026-04-13': { done: true },
      '2026-04-15': { done: true },
      '2026-04-17': { done: true }
    }
  })
  const result = computeStreak(h, today)
  assert.equal(result.unit, 'tyg')
  assert.equal(result.streak >= 1, true)
})

test('computeStreak: nPerWeek(3) week with 2 done does not count', () => {
  const today = new Date('2026-04-20')
  const h = makeHabit({
    createdAt: '2026-04-13',
    schedule: { type: 'nPerWeek', count: 3 },
    log: {
      '2026-04-13': { done: true },
      '2026-04-15': { done: true }
      // only 2 of 3 needed
    }
  })
  const result = computeStreak(h, today)
  assert.equal(result.unit, 'tyg')
  // streak for completed past week = 0 (2 < 3)
  assert.equal(result.streak, 0)
})

// --- computeStreak: dailyMinutes ---

test('computeStreak: dailyMinutes(10) counts done days correctly', () => {
  const today = new Date('2026-04-20')
  const h = makeHabit({
    createdAt: '2026-04-18',
    schedule: { type: 'dailyMinutes', minutes: 10 },
    log: {
      '2026-04-18': { done: true, minutes: 10 },
      '2026-04-19': { done: true, minutes: 15 },
      '2026-04-20': { done: true, minutes: 5 } // <10 but done=true counts
    }
  })
  const result = computeStreak(h, today)
  assert.equal(result.streak, 3)
  assert.equal(result.unit, 'dni')
})

// --- computeStreak: weeklyMinutes ---

test('computeStreak: weeklyMinutes(180) week with 180+ min increments week', () => {
  const today = new Date('2026-04-20') // next week
  const h = makeHabit({
    createdAt: '2026-04-13',
    schedule: { type: 'weeklyMinutes', minutes: 180 },
    log: {
      '2026-04-13': { done: true, minutes: 60 },
      '2026-04-15': { done: true, minutes: 60 },
      '2026-04-17': { done: true, minutes: 60 }
    }
  })
  const result = computeStreak(h, today)
  assert.equal(result.unit, 'tyg')
  assert.equal(result.streak >= 1, true)
})

// --- edge: createdAt === today ---

test('computeStreak: createdAt === today with no log -> streak=0', () => {
  const today = new Date('2026-04-20')
  const h = makeHabit({ createdAt: '2026-04-20', schedule: { type: 'daily' } })
  const result = computeStreak(h, today)
  assert.equal(result.streak, 0)
})

test('computeStreak: createdAt === today with done -> streak=1', () => {
  const today = new Date('2026-04-20')
  const h = makeHabit({
    createdAt: '2026-04-20',
    schedule: { type: 'daily' },
    log: { '2026-04-20': { done: true } }
  })
  const result = computeStreak(h, today)
  assert.equal(result.streak, 1)
})

// --- weeklyProgress ---

test('weeklyProgress: nPerWeek counts done days in week', () => {
  const h = makeHabit({
    schedule: { type: 'nPerWeek', count: 3 },
    log: {
      '2026-04-13': { done: true },
      '2026-04-15': { done: true }
    }
  })
  const weekStart = new Date('2026-04-13')
  const result = weeklyProgress(h, weekStart)
  assert.equal(result.got, 2)
  assert.equal(result.goal, 3)
})

test('weeklyProgress: weeklyMinutes sums minutes in week', () => {
  const h = makeHabit({
    schedule: { type: 'weeklyMinutes', minutes: 180 },
    log: {
      '2026-04-13': { done: true, minutes: 60 },
      '2026-04-14': { done: true, minutes: 45 }
    }
  })
  const weekStart = new Date('2026-04-13')
  const result = weeklyProgress(h, weekStart)
  assert.equal(result.got, 105)
  assert.equal(result.goal, 180)
})

// --- scheduleLabel ---

test('scheduleLabel: all types', () => {
  assert.equal(scheduleLabel({ type: 'daily' }), 'Codziennie')
  assert.equal(scheduleLabel({ type: 'interval', every: 3 }), 'Co 3 dni')
  assert.equal(scheduleLabel({ type: 'nPerWeek', count: 3 }), '3× w tygodniu')
  assert.equal(scheduleLabel({ type: 'dailyMinutes', minutes: 10 }), 'Min 10 min/dzień')
  assert.equal(scheduleLabel({ type: 'weeklyMinutes', minutes: 180 }), 'Min 180 min/tydzień')
})

// --- HABIT_ICONS & DEFAULT_FREEZE_AVAILABLE ---

test('HABIT_ICONS is a non-empty readonly array', () => {
  assert.equal(Array.isArray(HABIT_ICONS), true)
  assert.equal(HABIT_ICONS.length >= 10, true)
})

test('DEFAULT_FREEZE_AVAILABLE is 1', () => {
  assert.equal(DEFAULT_FREEZE_AVAILABLE, 1)
})
