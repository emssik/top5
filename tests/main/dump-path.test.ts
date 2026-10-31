import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openableDumpPath } from '../../src/main/dump-path'
import { registerLauncherHandlers } from '../../src/main/launchers'

const h = vi.hoisted(() => ({ openPath: vi.fn() }))
vi.mock('electron', () => ({ shell: { openPath: h.openPath, openExternal: vi.fn() } }))

const BLOCKED = ['x.command', 'x.sh', 'X.SH', 'x.tool', 'x.terminal', 'x.jar', 'x.fileloc', 'x.webloc', 'x.inetloc', 'x.pkg', 'x.mpkg']

let T: string
let R: string

function file(name: string, mode = 0o644): void {
  const p = join(T, name)
  writeFileSync(p, 'x')
  chmodSync(p, mode)
}

beforeAll(() => {
  T = mkdtempSync(join(tmpdir(), 'top5-dump-path-'))
  R = realpathSync(T)
  file('a.md')
  file('My Doc.txt')
  mkdirSync(join(T, 'sub'))
  mkdirSync(join(T, 'Foo.app'))
  file('run', 0o755)
  file('b.md', 0o744)
  for (const n of BLOCKED) file(n)
  symlinkSync(join(T, 'x.command'), join(T, 'link.md'))
  symlinkSync(join(T, 'a.md'), join(T, 'good-link.txt'))
})

afterAll(() => rmSync(T, { recursive: true, force: true }))

describe('openableDumpPath', () => {
  it('allows a regular file, absolute or ~', () => {
    expect(openableDumpPath(T + '/a.md', T)).toBe(R + '/a.md')
    expect(openableDumpPath('~/a.md', T)).toBe(R + '/a.md')
    expect(openableDumpPath(T + '/My Doc.txt', T)).toBe(R + '/My Doc.txt')
  })

  it('returns the real path of a symlink to an allowed file', () => {
    expect(openableDumpPath(T + '/good-link.txt', T)).toBe(R + '/a.md')
  })

  it('refuses missing files without logging', () => {
    const err = vi.spyOn(console, 'error')
    expect(openableDumpPath(T + '/nope.md', T)).toBeNull()
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it('refuses directories and bundles', () => {
    expect(openableDumpPath(T + '/sub', T)).toBeNull()
    expect(openableDumpPath(T + '/Foo.app', T)).toBeNull()
  })

  it('refuses any execute bit', () => {
    expect(openableDumpPath(T + '/run', T)).toBeNull()
    expect(openableDumpPath(T + '/b.md', T)).toBeNull()
  })

  it.each(BLOCKED)('refuses blocked extension %s', (n) => {
    expect(openableDumpPath(T + '/' + n, T)).toBeNull()
  })

  it('checks the extension of the real path behind a symlink', () => {
    expect(openableDumpPath(T + '/link.md', T)).toBeNull()
  })

  it.each(['a.md', './a.md', '~a.md', '', 123, null, undefined, {}, '/x\0.md'])('refuses untrusted input %j', (raw) => {
    expect(openableDumpPath(raw, T)).toBeNull()
  })
})

describe('open-dump-path handler', () => {
  function handler(): (e: unknown, raw: unknown) => unknown {
    const handlers = new Map<string, (e: unknown, raw: unknown) => unknown>()
    registerLauncherHandlers({ handle: (c: string, f: never) => handlers.set(c, f) } as never)
    return handlers.get('open-dump-path')!
  }

  it('opens the real path of an allowed file', () => {
    h.openPath.mockClear()
    handler()(null, T + '/a.md')
    expect(h.openPath).toHaveBeenCalledTimes(1)
    expect(h.openPath).toHaveBeenCalledWith(R + '/a.md')
  })

  it('does not open blocked or missing files', () => {
    h.openPath.mockClear()
    const f = handler()
    f(null, T + '/x.command')
    f(null, '~/nope.md')
    expect(h.openPath).not.toHaveBeenCalled()
  })
})
