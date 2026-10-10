import { describe, it, expect, beforeEach } from 'vitest'
import { rmSync, writeFileSync, utimesSync } from 'fs'
import { join } from 'path'
import { setupTestEnv, getTestServer, getTestApiKey, getTestDir } from './setup'
import { toggleDumpLines, countDumpLines, dumpItemTitle, moveDumpItems, addOpenLines } from '../../src/shared/dump'

setupTestEnv()

const auth = { authorization: `Bearer ${getTestApiKey()}` }
const D = '2026-09-25'

describe('toggleDumpLines (⌘D)', () => {
  it('completes an open line: moves it under a new ## Done header', () => {
    const text = '- a\n- b\n- c\n'
    const r = toggleDumpLines(text, 4, 4, D)!
    expect(r.text).toBe(`- a\n- c\n\n## Done\n+ ${D} b\n`)
    expect(r.cursor).toBe(4) // start of "- c", which took b's place
  })

  it('puts the newest on top of an existing done section; plain text is treated as open', () => {
    const text = `plain\n- a\n\n## Zrobione\n+ 2026-01-01 x\n`
    const r = toggleDumpLines(text, 0, 0, D)!
    expect(r.text).toBe(`- a\n\n## Zrobione\n+ ${D} plain\n+ 2026-01-01 x\n`)
  })

  it('reopens a done line: strips the date, moves it above the header', () => {
    const text = `- a\n\n## Zrobione\n+ 2026-01-01 x\n+ y\n`
    const r = toggleDumpLines(text, text.indexOf('+ 2026'), text.indexOf('+ 2026'), D)!
    expect(r.text).toBe(`- a\n- x\n\n## Zrobione\n+ y\n`)
  })

  it('handles a multi-line selection, skipping blanks and headings', () => {
    const text = '- a\n\n- b\n- c\n'
    const r = toggleDumpLines(text, 0, text.indexOf('- c'), D)! // ends at column 0 of "- c"
    expect(r.text).toBe(`\n- c\n\n## Done\n+ ${D} a\n+ ${D} b\n`)
    expect(toggleDumpLines('\n## Zrobione\n', 0, 12, D)).toBeNull()
  })

  it('completes into an existing ## Done section', () => {
    const text = `## Inbox\n\n- a\n\n## Done\n+ 2026-01-01 x\n`
    expect(toggleDumpLines(text, text.indexOf('- a'), text.indexOf('- a'), D)!.text).toBe(`## Inbox\n\n## Done\n+ ${D} a\n+ 2026-01-01 x\n`)
  })

  it('keeps a blank line under ## Done and the caret on its line when Done is above it', () => {
    const text = `## Done\n\n+ 2026-01-01 x\n\n## Inbox\n\n- a\n- b\n`
    const r = toggleDumpLines(text, text.indexOf('- a'), text.indexOf('- a'), D)!
    expect(r.text).toBe(`## Done\n\n+ ${D} a\n+ 2026-01-01 x\n\n## Inbox\n\n- b\n`)
    expect(r.cursor).toBe(r.text.indexOf('- b'))
    expect(toggleDumpLines('## Done\n\n## Inbox\n- a\n', 18, 18, D)!.text).toBe(`## Done\n+ ${D} a\n\n## Inbox\n`)
  })

  it('counts open / done lines', () => {
    expect(countDumpLines('- a\n  - b\n+ c\ntext\n## Zrobione')).toEqual({ open: 2, done: 1 })
  })
})

describe('dump sections', () => {
  const doc = `## Now\n\n- n1\n\n## Next\n\n## Inbox\n\n- i1\n  szczegół\n- i2\n\n## Done\n+ ${D} d1\n`

  it('adds new lines on top of ## Inbox, one blank line below the header', () => {
    expect(addOpenLines(doc, ['x', 'y'])).toBe(doc.replace('## Inbox\n\n', '## Inbox\n\n- x\n- y\n'))
    expect(addOpenLines('## Inbox\n\n## Done\n', ['x'])).toBe('## Inbox\n\n- x\n\n## Done\n')
    expect(addOpenLines('## Inbox\n- a\n', ['x'])).toBe('## Inbox\n\n- x\n- a\n')
    // No Inbox: above ## Done, entries kept in order.
    expect(addOpenLines('- a\n\n## Zrobione\n', ['x', 'y'])).toBe('- a\n- x\n- y\n\n## Zrobione\n')
  })

  it('⌘1 moves an item with its continuation to the end of ## Now, caret stays in place', () => {
    const r = moveDumpItems(doc, doc.indexOf('szczegół'), doc.indexOf('szczegół'), 'Now')!
    expect(r.text).toBe(`## Now\n\n- n1\n- i1\n  szczegół\n\n## Next\n\n## Inbox\n\n- i2\n\n## Done\n+ ${D} d1\n`)
    expect(r.text.slice(r.cursor).startsWith('- i2')).toBe(true)
  })

  it('⌘2 into an empty ## Next adds a blank line; a done item is reopened', () => {
    const r = moveDumpItems(doc, doc.indexOf('+ '), doc.indexOf('+ '), 'Next')!
    expect(r.text).toBe(`## Now\n\n- n1\n\n## Next\n\n- d1\n\n## Inbox\n\n- i1\n  szczegół\n- i2\n\n## Done\n`)
  })

  it('⌘3 moves an item to the top of ## Inbox', () => {
    const r = moveDumpItems(doc, doc.indexOf('- n1'), doc.indexOf('- n1'), 'Inbox')!
    expect(r.text).toBe(`## Now\n\n## Next\n\n## Inbox\n\n- n1\n- i1\n  szczegół\n- i2\n\n## Done\n+ ${D} d1\n`)
  })

  it('no-op when the item is already there or the section is missing', () => {
    expect(moveDumpItems(doc, 10, 10, 'Now')).toBeNull()
    expect(moveDumpItems('- a\n', 0, 0, 'Now')).toBeNull()
    expect(moveDumpItems('## Next.js\n- a\n', 12, 12, 'Next')).toBeNull()
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

describe('dump ↔ quick task link (⌘F)', () => {
  it('finds the title of the open item under the cursor', () => {
    const text = '- a\n- zadzwonić\ndo X\n+ 2026-01-01 b\n# note\n'
    expect(dumpItemTitle(text, text.indexOf('do X'))).toBe('zadzwonić')
    expect(dumpItemTitle(text, text.indexOf('+ 2026'))).toBeNull()
    expect(dumpItemTitle(text, text.indexOf('# note'))).toBeNull()
  })

  it('completing a quick task ticks off the dump item with the same title', async () => {
    const server = await getTestServer()
    writeFileSync(join(getTestDir(), 'dump.md'), '- a\n- zadzwonić\ndo X\n')
    const id = 'qt-dump-link'
    const task = { id, title: 'zadzwonić', completed: false, createdAt: new Date().toISOString(), completedAt: null, order: 0 }
    const created = await server.inject({ method: 'POST', url: '/api/v1/quick-tasks', headers: auth, payload: task })
    expect(created.statusCode).toBe(201)
    await server.inject({ method: 'POST', url: `/api/v1/quick-tasks/${id}/complete`, headers: auth })
    const res = await server.inject({ method: 'GET', url: '/api/v1/dump', headers: auth })
    expect(res.json().data.text).toMatch(/^- a\n\n## Done\n\+ \d{4}-\d{2}-\d{2} zadzwonić\ndo X\n$/)
  })
})
