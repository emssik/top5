import { describe, it, expect, beforeEach } from 'vitest'
import { rmSync, writeFileSync, utimesSync } from 'fs'
import { join } from 'path'
import { setupTestEnv, getTestServer, getTestApiKey, getTestDir } from './setup'
import { toggleDumpLines, countDumpLines } from '../../src/shared/dump'

setupTestEnv()

const auth = { authorization: `Bearer ${getTestApiKey()}` }
const D = '2026-09-25'

describe('toggleDumpLines (⌘D)', () => {
  it('completes an open line: moves it under a new ## Zrobione header', () => {
    const text = '- a\n- b\n- c\n'
    const r = toggleDumpLines(text, 4, 4, D)!
    expect(r.text).toBe(`- a\n- c\n\n## Zrobione\n+ ${D} b\n`)
    expect(r.cursor).toBe(4) // start of "- c", which took b's place
  })

  it('appends to an existing done section; plain text is treated as open', () => {
    const text = `plain\n- a\n\n## Zrobione\n+ 2026-01-01 x\n`
    const r = toggleDumpLines(text, 0, 0, D)!
    expect(r.text).toBe(`- a\n\n## Zrobione\n+ 2026-01-01 x\n+ ${D} plain\n`)
  })

  it('reopens a done line: strips the date, moves it above the header', () => {
    const text = `- a\n\n## Zrobione\n+ 2026-01-01 x\n+ y\n`
    const r = toggleDumpLines(text, text.indexOf('+ 2026'), text.indexOf('+ 2026'), D)!
    expect(r.text).toBe(`- a\n- x\n\n## Zrobione\n+ y\n`)
  })

  it('handles a multi-line selection, skipping blanks and headings', () => {
    const text = '- a\n\n- b\n- c\n'
    const r = toggleDumpLines(text, 0, text.indexOf('- c'), D)! // ends at column 0 of "- c"
    expect(r.text).toBe(`\n- c\n\n## Zrobione\n+ ${D} a\n+ ${D} b\n`)
    expect(toggleDumpLines('\n## Zrobione\n', 0, 12, D)).toBeNull()
  })

  it('counts open / done lines', () => {
    expect(countDumpLines('- a\n  - b\n+ c\ntext\n## Zrobione')).toEqual({ open: 2, done: 1 })
  })
})

describe('Dump API', () => {
  beforeEach(() => {
    rmSync(join(getTestDir(), 'dump.md'), { force: true })
  })

  it('GET returns empty text and null mtime when the file is missing', async () => {
    const server = await getTestServer()
    const res = await server.inject({ method: 'GET', url: '/api/v1/dump', headers: auth })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, data: { text: '', mtime: null } })
  })

  it('PUT saves with matching baseMtime, then 409 on a stale one', async () => {
    const server = await getTestServer()
    const first = await server.inject({ method: 'PUT', url: '/api/v1/dump', headers: auth, payload: { text: '- a\n', baseMtime: null } })
    expect(first.statusCode).toBe(200)
    const { mtime } = first.json().data
    expect(typeof mtime).toBe('number')

    // Simulate an external edit with a different mtime
    writeFileSync(join(getTestDir(), 'dump.md'), '- external\n')
    utimesSync(join(getTestDir(), 'dump.md'), new Date(), new Date(mtime + 5000))

    const stale = await server.inject({ method: 'PUT', url: '/api/v1/dump', headers: auth, payload: { text: '- mine\n', baseMtime: mtime } })
    expect(stale.statusCode).toBe(409)
    expect(stale.json()).toEqual({ ok: false, error: 'conflict' })

    const get = await server.inject({ method: 'GET', url: '/api/v1/dump', headers: auth })
    expect(get.json().data.text).toBe('- external\n')
  })

  it('PUT rejects a non-string text and oversized text with 400', async () => {
    const server = await getTestServer()
    const bad = await server.inject({ method: 'PUT', url: '/api/v1/dump', headers: auth, payload: { text: 42, baseMtime: null } })
    expect(bad.statusCode).toBe(400)
    const big = await server.inject({ method: 'PUT', url: '/api/v1/dump', headers: auth, payload: { text: 'x'.repeat(1_000_001), baseMtime: null } })
    expect(big.statusCode).toBe(400)
    expect(big.json().error).toBe('too_large')
  })

  it('POST /dump/append inserts above ## Zrobione and adds "- " prefix', async () => {
    const server = await getTestServer()
    writeFileSync(join(getTestDir(), 'dump.md'), `- a\n\n## Zrobione\n+ ${D} x\n`)
    const res = await server.inject({ method: 'POST', url: '/api/v1/dump/append', headers: auth, payload: { line: 'nowe' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.text).toBe(`- a\n- nowe\n\n## Zrobione\n+ ${D} x\n`)

    const bad = await server.inject({ method: 'POST', url: '/api/v1/dump/append', headers: auth, payload: { line: 'a\nb' } })
    expect(bad.statusCode).toBe(400)
  })

  it('requires auth', async () => {
    const server = await getTestServer()
    const res = await server.inject({ method: 'GET', url: '/api/v1/dump' })
    expect(res.statusCode).toBe(401)
  })
})
