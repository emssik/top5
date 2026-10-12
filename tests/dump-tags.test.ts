import test from 'node:test'
import assert from 'node:assert/strict'
import { completeDumpItem, countSectionOpen, dumpCurrentSection, dumpFoldEnd, findDumpItem, findDumpTags, projectTagTrigger, setDumpItemTag, stripDumpTags } from '../src/shared/dump'
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

import { formatDumpPaste } from '../src/shared/dump'

test('dumpLineHang: `* ` sub-points wrap under their text', () => {
  assert.deepEqual(dumpLineHang('  * Funkcje wykonawcze'), { kind: 'plain', hang: 4 })
  assert.deepEqual(dumpLineHang('* punkt'), { kind: 'plain', hang: 2 })
  assert.deepEqual(dumpLineHang('*bez spacji'), { kind: 'plain', hang: 0 })
})

test('formatDumpPaste: several lines become an item with `* ` sub-points', () => {
  const list = 'Książki do przeczytania\n\n- Funkcje wykonawcze\n* Wielkie problemy\r\n1. Zabawa w uważność\n'
  // Empty line: a new item, its sub-points two spaces in.
  assert.equal(formatDumpPaste('', '', list), '- Książki do przeczytania\n  * Funkcje wykonawcze\n  * Wielkie problemy\n  * Zabawa w uważność')
  assert.equal(formatDumpPaste('  ', '', 'a\nb'), '- a\n    * b')
  // End of an item line: every line under it.
  assert.equal(formatDumpPaste('- Książki', '', 'a\n• b'), '\n  * a\n  * b')
  assert.equal(formatDumpPaste('  + 2026-10-10 x', '', 'a\nb'), '\n    * a\n    * b')
  // Empty `* ` (after Enter in a sub-point) and the end of a sub-point: same level.
  assert.equal(formatDumpPaste('  * ', '', 'a\nb'), 'a\n  * b')
  assert.equal(formatDumpPaste('  * jest', '', 'a\nb'), '\n  * a\n  * b')
})

test('formatDumpPaste: pasted as is', () => {
  assert.equal(formatDumpPaste('', '', 'jedna linia\n\n'), null)
  assert.equal(formatDumpPaste('- x', 'reszta', 'a\nb'), null) // middle of a line
  assert.equal(formatDumpPaste('', '', '- a\n  detal\n- b'), null) // already dump text
  assert.equal(formatDumpPaste('', '', '## Now\n- a'), null)
  assert.equal(formatDumpPaste('## Now', '', 'a\nb'), null)
  assert.equal(formatDumpPaste('zwykły tekst', '', 'a\nb'), null)
})
test('dumpCurrentSection: section containing pos, up to the next header', () => {
  const t = '## Now\n- a\n\n## Next\n- b\n'
  assert.deepEqual(dumpCurrentSection(t, 8), { from: 0, to: 12 })
  assert.deepEqual(dumpCurrentSection(t, 0), { from: 0, to: 12 })
  assert.deepEqual(dumpCurrentSection(t, 15), { from: 12, to: 24 })
})

test('dumpCurrentSection: before first header, no headers, clamp, not-a-header', () => {
  assert.deepEqual(dumpCurrentSection('intro\n## Now\n- a', 2), { from: 0, to: 6 })
  assert.equal(dumpCurrentSection('- a\n- b', 3), null)
  assert.deepEqual(dumpCurrentSection('## Now\n- a', 999), { from: 0, to: 10 })
  assert.deepEqual(dumpCurrentSection('## Now\n- a\n##Next\n- b', 16), { from: 0, to: 21 })
  assert.deepEqual(dumpCurrentSection('intro\n## Now\n- a', 8), { from: 6, to: 16 })
})

const foldEnd = (lines: string[], i: number) => dumpFoldEnd((n) => lines[n] ?? null, i)

test('dumpFoldEnd folds an item with sub-points or notes', () => {
  assert.equal(foldEnd(['- Ogarnąć chrzciny', '  * zaświadczenie', '  * spotkanie 5.11', ''], 0), 2)
  assert.equal(foldEnd(['- aplikacja do serwerów', '  potencjalne problemy', '  face', '- Zadzwonić'], 0), 2)
  assert.equal(foldEnd(['+ 2026-10-01 zrobione', '  * notatka'], 0), 1)
  assert.equal(foldEnd(['    - wcięty', '      * pod'], 0), 1)
})

test('dumpFoldEnd stops at headers and comments', () => {
  assert.equal(foldEnd(['- x', '  * a', '## Next'], 0), 1)
  assert.equal(foldEnd(['- x', '  * a', '# komentarz'], 0), 1)
})

test('dumpFoldEnd is null where nothing can be folded', () => {
  assert.equal(foldEnd(['- Zadzwonić', '- UODO'], 0), null)
  assert.equal(foldEnd(['- Zadzwonić'], 0), null)
  assert.equal(foldEnd(['## Now', '- x'], 0), null)
  assert.equal(foldEnd(['- x', '  * a'], 1), null)
  assert.equal(foldEnd(['luźny tekst', 'dalszy'], 0), null)
  assert.equal(foldEnd(['- x', '  * a'], 5), null)
})
