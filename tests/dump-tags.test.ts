import test from 'node:test'
import assert from 'node:assert/strict'
import { completeDumpItem, countSectionOpen, findDumpItem, findDumpTags, projectTagTrigger, setDumpItemTag, stripDumpTags } from '../src/shared/dump'
import { parseRepeatLine } from '../src/shared/dump-repeat'

const CODES = ['ATD', 'BIZ']

test('findDumpTags finds known tags, case-insensitive', () => {
  assert.deepEqual(findDumpTags('- Oferta #ATD\n', ['ATD']), [{ start: 9, end: 13, code: 'ATD' }])
  assert.deepEqual(findDumpTags('- Oferta #atd jutro', ['ATD']), [{ start: 9, end: 13, code: 'ATD' }])
})

test('findDumpTags ignores line start, comments, unknown codes and no-space hashes', () => {
  assert.deepEqual(findDumpTags('#ATD notatka', ['ATD']), [])
  assert.deepEqual(findDumpTags('# komentarz #ATD', ['ATD']), [])
  assert.deepEqual(findDumpTags('- issue #123 fix', ['ATD']), [])
  assert.deepEqual(findDumpTags('- a#ATD', ['ATD']), [])
})

test('findDumpTags offsets work on later lines', () => {
  assert.deepEqual(findDumpTags('- a\n- b #ATD', ['ATD']), [{ start: 8, end: 12, code: 'ATD' }])
})

test('stripDumpTags', () => {
  assert.equal(stripDumpTags('Oferta #ATD dla X', CODES), 'Oferta dla X')
  assert.equal(stripDumpTags('Oferta #ATD', CODES), 'Oferta')
  assert.equal(stripDumpTags('Oferta', CODES), 'Oferta')
})

test('setDumpItemTag appends, replaces and handles continuation lines', () => {
  assert.equal(setDumpItemTag('- Oferta\n', 3, 'ATD', CODES)?.text, '- Oferta #ATD\n')
  assert.equal(setDumpItemTag('- Oferta #BIZ\n', 3, 'ATD', CODES)?.text, '- Oferta #ATD\n')
  const r = setDumpItemTag('- Oferta\n  detal\n', 12, 'ATD', CODES)
  assert.equal(r?.text, '- Oferta #ATD\n  detal\n')
  assert.equal(r?.cursor, 17)
  assert.equal(setDumpItemTag('- Oferta\n', 3, 'ATD', CODES)?.cursor, 3)
})

test('setDumpItemTag returns null on headers and empty lines', () => {
  assert.equal(setDumpItemTag('## Now\n', 2, 'ATD', CODES), null)
  assert.equal(setDumpItemTag('- a\n\n- b\n', 4, 'ATD', CODES), null)
})

test('projectTagTrigger', () => {
  assert.deepEqual(projectTagTrigger('- Oferta #', 10), { start: 9, query: '' })
  assert.deepEqual(projectTagTrigger('- Oferta #at', 12), { start: 9, query: 'at' })
  assert.deepEqual(projectTagTrigger('- #', 3), { start: 2, query: '' })
  assert.deepEqual(projectTagTrigger('a\n- x #b', 8), { start: 6, query: 'b' })
  assert.equal(projectTagTrigger('#', 1), null)
  assert.equal(projectTagTrigger('##', 2), null)
  assert.equal(projectTagTrigger('## Now', 6), null)
  assert.equal(projectTagTrigger('  #', 3), null)
  assert.equal(projectTagTrigger('# komentarz #', 13), null)
  assert.equal(projectTagTrigger('- Oferta #at x', 14), null)
})

test('countSectionOpen counts open items of one section', () => {
  assert.equal(countSectionOpen('## Now\n- a\n+ b\n- c\n## Next\n- d\n', 'Now'), 2)
  assert.equal(countSectionOpen('- a\n## Next\n- d\n', 'Now'), 0)
})

test('item matching ignores tags', () => {
  assert.equal(findDumpItem('- Oferta #ATD\n', 'Oferta'), 0)
  assert.equal(completeDumpItem('- Oferta #ATD\n', 'Oferta', '2026-10-10'), '## Done\n+ 2026-10-10 Oferta #ATD\n')
})

test('parseRepeatLine valid schedules', () => {
  assert.deepEqual(parseRepeatLine('- codziennie: Medytacja', CODES), { title: 'Medytacja', schedule: { type: 'daily' }, projectCode: null })
  assert.deepEqual(parseRepeatLine('pon śr pt: Wynieść śmieci', CODES)?.schedule, { type: 'weekdays', days: [1, 3, 5] })
  assert.deepEqual(parseRepeatLine('Pon, sr, PT: X', CODES)?.schedule, { type: 'weekdays', days: [1, 3, 5] })
  assert.deepEqual(parseRepeatLine('sob nd: X', CODES)?.schedule, { type: 'weekdays', days: [6, 0] })
  assert.deepEqual(parseRepeatLine('dni robocze: X', CODES)?.schedule, { type: 'weekdays', days: [1, 2, 3, 4, 5] })
  assert.deepEqual(parseRepeatLine('co 3 dni: Podlać kwiaty', CODES), { title: 'Podlać kwiaty', schedule: { type: 'interval', days: 3 }, projectCode: null })
  assert.deepEqual(parseRepeatLine('15 dnia: Faktura ZUS #BIZ', CODES), { title: 'Faktura ZUS', schedule: { type: 'monthlyDay', day: 15 }, projectCode: 'BIZ' })
  assert.deepEqual(parseRepeatLine('koniec miesiąca: Raport', CODES)?.schedule, { type: 'monthlyLastDay' })
  assert.deepEqual(parseRepeatLine('koniec miesiaca: Raport', CODES)?.schedule, { type: 'monthlyLastDay' })
})

test('parseRepeatLine rejects invalid lines', () => {
  for (const line of ['32 dnia: X', 'co 0 dni: X', 'pon: ', 'Oferta dla X', 'jutro: X', 'constructor: X']) {
    assert.equal(parseRepeatLine(line, CODES), null, line)
  }
})

test('setDumpItemTag keeps indentation; a tag at the title start is still a tag', () => {
  assert.equal(setDumpItemTag('  - Oferta #BIZ\n', 4, 'ATD', CODES)?.text, '  - Oferta #ATD\n')
  assert.equal(stripDumpTags('#ATD Oferta', CODES), 'Oferta')
  assert.equal(findDumpItem('- #ATD Oferta\n', 'Oferta'), 0)
  assert.equal(findDumpItem('- #ATD\n', '#BIZ'), null)
})

test('non-project hashtags stay: ⌘P, ⌘F titles and ⌘R keep them, matching still links the line', () => {
  assert.equal(stripDumpTags('Napraw #pilne #ATD', CODES), 'Napraw #pilne')
  assert.equal(setDumpItemTag('- Napraw #pilne\n', 3, 'ATD', CODES)?.text, '- Napraw #pilne #ATD\n')
  assert.deepEqual(parseRepeatLine('codziennie: Czytaj #rozdział #ATD', CODES), { title: 'Czytaj #rozdział', schedule: { type: 'daily' }, projectCode: 'ATD' })
  assert.equal(parseRepeatLine('codziennie: Czytaj #rozdział', CODES)?.projectCode, null)
  assert.equal(findDumpItem('- Napraw #pilne #ATD\n', 'Napraw #pilne'), 0)
})

test('item matching keeps the title\'s own hashtags', () => {
  assert.equal(findDumpItem('- Napraw #pilne\n- Napraw #jutro\n', 'Napraw #jutro'), 16)
  assert.equal(findDumpItem('- Napraw\n', 'Napraw #pilne'), null)
})

test('parseRepeatLine tolerates stray commas between days', () => {
  assert.deepEqual(parseRepeatLine('pon, śr,: X', CODES)?.schedule, { type: 'weekdays', days: [1, 3] })
  assert.equal(parseRepeatLine(', : X', CODES), null)
})

import { findDumpSectionHeaders } from '../src/shared/dump'

test('findDumpSectionHeaders lists `## ` lines (whole line, trailing spaces included)', () => {
  assert.deepEqual(findDumpSectionHeaders('## Now\n- a\n## Next\n'), [{ start: 0, end: 6 }, { start: 11, end: 18 }])
  assert.deepEqual(findDumpSectionHeaders('## Inbox  '), [{ start: 0, end: 10 }])
})

test('findDumpSectionHeaders ignores other lines', () => {
  assert.deepEqual(findDumpSectionHeaders('- a\n### Pod\n  ## x\n# komentarz\n'), [])
  assert.deepEqual(findDumpSectionHeaders('## \n##Now\n'), [])
  assert.deepEqual(findDumpSectionHeaders(''), [])
})

import { dumpLineHang } from '../src/shared/dump'

test('dumpLineHang: headers, items and plain lines', () => {
  assert.deepEqual(dumpLineHang('## Now'), { kind: 'header', hang: 3 })
  assert.deepEqual(dumpLineHang('## '), { kind: 'plain', hang: 0 })
  assert.deepEqual(dumpLineHang('### Pod'), { kind: 'plain', hang: 0 })
  assert.deepEqual(dumpLineHang('- dokumenty dla Ani'), { kind: 'item', hang: 2 })
  assert.deepEqual(dumpLineHang('+ ↻ zrobione'), { kind: 'item', hang: 2 })
  assert.deepEqual(dumpLineHang('  - podpunkt'), { kind: 'item', hang: 4 })
  assert.deepEqual(dumpLineHang('  detal pod punktem'), { kind: 'plain', hang: 2 })
  assert.deepEqual(dumpLineHang('# komentarz'), { kind: 'plain', hang: 0 })
  assert.deepEqual(dumpLineHang('zwykły tekst'), { kind: 'plain', hang: 0 })
  assert.deepEqual(dumpLineHang(''), { kind: 'plain', hang: 0 })
  assert.deepEqual(dumpLineHang('-bez spacji'), { kind: 'plain', hang: 0 })
})
