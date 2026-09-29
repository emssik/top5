import test from 'node:test'
import assert from 'node:assert/strict'
import { appendOpenLine, mergeExternalAppends } from '../src/shared/dump'

const base = '- a\n- b\n\n## Zrobione\n+ 2026-09-27 c\n'

test('mergeExternalAppends keeps local edits and adds lines appended from outside', () => {
  const theirs = appendOpenLine(appendOpenLine(base, 'z maila'), 'drugie')
  const mine = '- a zmienione\n- b\n- nowe lokalne\n\n## Zrobione\n+ 2026-09-27 c\n'
  assert.equal(mergeExternalAppends(base, theirs, mine), '- a zmienione\n- b\n- nowe lokalne\n- z maila\n- drugie\n\n## Zrobione\n+ 2026-09-27 c\n')
})

test('mergeExternalAppends returns mine when the file content did not change', () => {
  assert.equal(mergeExternalAppends(base, base, '- x\n'), '- x\n')
})

test('mergeExternalAppends refuses when a line was removed or changed outside', () => {
  assert.equal(mergeExternalAppends(base, '- a\n\n## Zrobione\n+ 2026-09-27 c\n+ 2026-09-28 b\n', base), null)
  assert.equal(mergeExternalAppends(base, base.replace('- b', '- B'), base), null)
})

test('mergeExternalAppends refuses when a non-open line was added', () => {
  assert.equal(mergeExternalAppends(base, `${base}+ 2026-09-28 d\n`, base), null)
})
