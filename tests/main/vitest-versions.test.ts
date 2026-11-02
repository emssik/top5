import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// npm only warns when vitest and its coverage plugin drift apart; the gate must fail instead.
const version = (pkg: string): string =>
  JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf8')).version

it('@vitest/coverage-v8 matches the installed vitest version (bump both together)', () => {
  expect(version('@vitest/coverage-v8')).toBe(version('vitest'))
})
