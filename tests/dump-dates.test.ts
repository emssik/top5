import test from 'node:test'
import assert from 'node:assert/strict'
import { completeDumpItem, findDumpItem, stripDumpTags } from '../src/shared/dump'
import { datedDumpItems, dropDumpDate, dumpDateAt, dumpDateTrigger, findDumpDates, parseDumpDate, setDumpItemDate } from '../src/shared/dump-dates'

const today = '2026-10-16' // a Friday

test('parseDumpDate: words and relative', () => {
  const rows: [string, string | null][] = [
    ['jutro', '2026-10-17'], ['Jutro ', '2026-10-17'], ['dziś', '2026-10-16'], ['dzis', '2026-10-16'], ['pojutrze', '2026-10-18'],
    ['+2d', '2026-10-18'], ['+1w', '2026-10-23'], ['+0d', null], ['+2x', null],
  ]
  for (const [input, want] of rows) assert.equal(parseDumpDate(input, today), want, input)
})

test('parseDumpDate: weekdays are strictly after today', () => {
  const rows: [string, string][] = [['pon', '2026-10-19'], ['pt', '2026-10-23'], ['śr', '2026-10-21'], ['sr', '2026-10-21'], ['nd', '2026-10-18'], ['sob', '2026-10-17'], ['czw', '2026-10-22'], ['wt', '2026-10-20']]
  for (const [input, want] of rows) assert.equal(parseDumpDate(input, today), want, input)
})

test('parseDumpDate: absolute dates', () => {
  const rows: [string, string | null][] = [
    ['20.10', '2026-10-20'], ['1.3', '2027-03-01'], ['16.10', '2026-10-16'], ['20.10.2027', '2027-10-20'], ['2026-12-01', '2026-12-01'],
    ['31.02', null], ['2026-13-01', null], ['kiedyś', null], ['', null],
  ]
  for (const [input, want] of rows) assert.equal(parseDumpDate(input, today), want, input)
})

test('parseDumpDate: month and year rollover', () => {
  assert.equal(parseDumpDate('jutro', '2026-12-31'), '2027-01-01')
  assert.equal(parseDumpDate('+1w', '2026-12-28'), '2027-01-04')
})

test('findDumpDates', () => {
  assert.deepEqual(findDumpDates('- Zadzwoń @2026-10-17'), [{ start: 10, end: 21, date: '2026-10-17' }])
  assert.deepEqual(findDumpDates('@2026-10-17 x\n# k @2026-10-17\n- a@2026-10-17\n- b @2026-10-17x'), [])
  const t = findDumpDates('- a\n- b @2026-10-17')
  assert.equal(t.length, 1)
  assert.equal(t[0].start, 8)
})

test('setDumpItemDate', () => {
  assert.equal(setDumpItemDate('- Zadzwoń #ATD', 3, '2026-10-17')?.text, '- Zadzwoń #ATD @2026-10-17')
  assert.equal(setDumpItemDate('- Zadzwoń @2026-10-17 #ATD', 0, '2026-10-20')?.text, '- Zadzwoń #ATD @2026-10-20')
  assert.equal(setDumpItemDate('- Zadzwoń @2026-10-17', 0, null)?.text, '- Zadzwoń')
  assert.equal(setDumpItemDate('- @2026-10-17', 0, null)?.text, '- ')
  assert.equal(setDumpItemDate('- @2026-10-17', 0, '2026-10-20')?.text, '- @2026-10-20')
  assert.equal(setDumpItemDate('- Zadzwoń\n  szczegóły', 12, '2026-10-17')?.text, '- Zadzwoń @2026-10-17\n  szczegóły')
  assert.equal(setDumpItemDate('\n## Now', 0, '2026-10-17'), null)
  assert.equal(setDumpItemDate('# k', 1, '2026-10-17'), null)
})

test('setDumpItemDate: cursor', () => {
  assert.equal(setDumpItemDate('- a', 3, '2026-10-17')?.cursor, 15)
  assert.equal(setDumpItemDate('- a\n- b', 1, '2026-10-17')?.cursor, 1)
  assert.equal(setDumpItemDate('- a @2026-10-17', 15, null)?.cursor, 3)
})

test('datedDumpItems', () => {
  const text = '## Now\n- a @2026-10-16\n## Inbox\n- b #ATD @2026-10-20\n- c @2026-10-15\n+ 2026-10-10 d @2026-10-01\n- e'
  assert.deepEqual(datedDumpItems(text), [
    { pos: text.indexOf('- c'), title: 'c', date: '2026-10-15' },
    { pos: text.indexOf('- b'), title: 'b #ATD', date: '2026-10-20' },
  ])
})

test('datedDumpItems: continuation dates ignored, ties keep text order, plain heads count', () => {
  const text = '- a\n  later @2026-10-01\n- x @2026-10-05\nplain @2026-10-05 y'
  assert.deepEqual(datedDumpItems(text), [
    { pos: text.indexOf('- x'), title: 'x', date: '2026-10-05' },
  ])
  const t2 = 'plain @2026-10-05 y\n\n- z @2026-10-05'
  assert.deepEqual(datedDumpItems(t2).map((i) => i.title), ['plain y', 'z'])
})

test('dumpDateTrigger', () => {
  assert.deepEqual(dumpDateTrigger('- a @ju', 7), { start: 4, query: 'ju' })
  assert.deepEqual(dumpDateTrigger('- a @', 5), { start: 4, query: '' })
  assert.deepEqual(dumpDateTrigger('- a @+2d', 8), { start: 4, query: '+2d' })
  assert.equal(dumpDateTrigger('- a@ju', 6), null)
  assert.equal(dumpDateTrigger('# a @ju', 7), null)
})

test('dump matching ignores date tokens', () => {
  assert.equal(stripDumpTags('Zadzwoń @2026-10-17 #ATD', ['ATD']), 'Zadzwoń')
  assert.equal(findDumpItem('- Zadzwoń @2026-10-17 #ATD', 'Zadzwoń'), 0)
  assert.equal(completeDumpItem('- Zadzwoń @2026-10-17', 'Zadzwoń', '2026-10-16'), '## Done\n+ 2026-10-16 Zadzwoń @2026-10-17')
})

test('parseDumpDate: base shifts only +Nd / +Nw', () => {
  const rows: [string, string, string | null][] = [
    ['+2d', '2026-10-17', '2026-10-19'], ['+1w', '2026-10-17', '2026-10-24'], ['+2d', '2026-12-31', '2027-01-02'],
    ['jutro', '2026-10-17', '2026-10-17'], ['pt', '2026-10-30', '2026-10-23'], ['20.10', '2026-10-30', '2026-10-20'],
    ['+0d', '2026-10-17', null],
  ]
  for (const [input, base, want] of rows) assert.equal(parseDumpDate(input, today, base), want, `${input} @ ${base}`)
  assert.equal(parseDumpDate('+2d', today), '2026-10-18')
})

test('dumpDateAt', () => {
  const t = '- a @2026-10-17'
  assert.deepEqual(dumpDateAt(t, 8), { start: 4, end: 15, date: '2026-10-17' })
  assert.deepEqual(dumpDateAt(t, 5), { start: 4, end: 15, date: '2026-10-17' })
  assert.equal(dumpDateAt(t, 4), null)
  assert.equal(dumpDateAt(t, 15), null)
  assert.equal(dumpDateAt('- a @2026-10-1', 8), null)
  assert.deepEqual(dumpDateAt('- x\n- a @2026-10-17', 12), { start: 8, end: 19, date: '2026-10-17' })
  assert.equal(dumpDateAt('# a @2026-10-17', 8), null)
})

test('review fixes: no throw / garbage, head lines only, date at title start', () => {
  assert.equal(parseDumpDate('constructor', today), null)
  assert.equal(parseDumpDate('+99999d', today), null)
  assert.equal(parseDumpDate('+9999d', today), '2054-03-02')
  const t = '- a @2026-10-17\n  * note @2026-10-20'
  assert.deepEqual(findDumpDates(t).map((d) => d.date), ['2026-10-17'])
  assert.equal(dumpDateAt(t, t.indexOf('@2026-10-20') + 3), null)
  assert.equal(stripDumpTags('@2026-10-17 Zadzwoń', []), 'Zadzwoń')
  assert.equal(findDumpItem('- @2026-10-17 Zadzwoń', 'Zadzwoń'), 0)
})

test('dropDumpDate keeps the marker of a date-only item', () => {
  const drop = (t: string) => dropDumpDate(t, dumpDateAt(t, t.length - 1)!)
  assert.deepEqual(drop('- a @2026-10-17'), { text: '- a', cursor: 3 })
  assert.deepEqual(drop('- x\n- @2026-10-17'), { text: '- x\n- ', cursor: 6 })
  assert.deepEqual(drop('  + @2026-10-17'), { text: '  + ', cursor: 4 })
})
