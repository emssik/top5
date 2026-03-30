import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseDate, formatDueDate } from '../src/lib/date'

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('parseDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses YYYY-MM-DD literal', () => {
    expect(parseDate('2026-04-15')).toBe('2026-04-15')
  })

  it('parses "today"', () => {
    expect(parseDate('today')).toBe('2026-03-30')
  })

  it('parses "tomorrow"', () => {
    expect(parseDate('tomorrow')).toBe('2026-03-31')
  })

  it('parses +Nd offset', () => {
    expect(parseDate('+3d')).toBe('2026-04-02')
    expect(parseDate('+0d')).toBe('2026-03-30')
    expect(parseDate('+1d')).toBe('2026-03-31')
  })

  it('parses day names (next occurrence)', () => {
    // 2026-03-30 is Monday
    expect(parseDate('tuesday')).toBe('2026-03-31')
    expect(parseDate('wed')).toBe('2026-04-01')
    expect(parseDate('friday')).toBe('2026-04-03')
    expect(parseDate('sunday')).toBe('2026-04-05')
    // Monday = same day of week, should go to NEXT monday
    expect(parseDate('monday')).toBe('2026-04-06')
    expect(parseDate('mon')).toBe('2026-04-06')
  })

  it('returns null for "clear" and "none"', () => {
    expect(parseDate('clear')).toBeNull()
    expect(parseDate('none')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(parseDate('TODAY')).toBe('2026-03-30')
    expect(parseDate('Tomorrow')).toBe('2026-03-31')
    expect(parseDate('CLEAR')).toBeNull()
    expect(parseDate('Mon')).toBe('2026-04-06')
  })

  it('trims whitespace', () => {
    expect(parseDate('  today  ')).toBe('2026-03-30')
  })

  it('throws on invalid format', () => {
    expect(() => parseDate('foo')).toThrow('Unrecognized date format')
    expect(() => parseDate('2026/04/15')).toThrow('Unrecognized date format')
    expect(() => parseDate('15-04-2026')).toThrow('Unrecognized date format')
  })

  it('throws on invalid YYYY-MM-DD date', () => {
    expect(() => parseDate('2026-13-45')).toThrow('Invalid date')
  })

  it('throws on dates that roll over (e.g. Feb 30)', () => {
    expect(() => parseDate('2026-02-30')).toThrow('Invalid date')
    expect(() => parseDate('2026-04-31')).toThrow('Invalid date')
    expect(() => parseDate('2026-06-31')).toThrow('Invalid date')
  })
})

describe('formatDueDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for null/undefined', () => {
    expect(formatDueDate(null)).toBe('')
    expect(formatDueDate(undefined)).toBe('')
  })

  it('returns "today" for today\'s date', () => {
    expect(formatDueDate('2026-03-30')).toBe('today')
  })

  it('returns "tomorrow" for tomorrow\'s date', () => {
    expect(formatDueDate('2026-03-31')).toBe('tomorrow')
  })

  it('returns date with (overdue) for past dates', () => {
    expect(formatDueDate('2026-03-28')).toBe('2026-03-28 (overdue)')
  })

  it('returns plain date for future dates', () => {
    expect(formatDueDate('2026-04-15')).toBe('2026-04-15')
  })
})
