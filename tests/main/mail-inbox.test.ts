import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import { pullMailTasks, parseMailTask } from '../../src/main/service/mail-inbox'
import { addOpenLines } from '../../src/shared/dump'

const h = vi.hoisted(() => {
  // Skips the zsh token lookup in claudeEnv.
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token'
  return {
    calls: [] as string[],
    client: {} as Record<string, ReturnType<typeof vi.fn>>,
    tasks: {} as Record<string, string[]>
  }
})

vi.mock('imapflow', () => ({
  ImapFlow: class {
    constructor() {
      return h.client as never
    }
  }
}))
vi.mock('node:fs', () => ({
  readFileSync: () => '[mailtodump]\nuser = "me@x.pl"\napp_password = "abcd efgh"\nsince = "2026-01-01"\n'
}))
vi.mock('node:child_process', () => ({
  execFile: (_cmd: string, _args: string[], _opts: unknown, cb: (e: null, out: string, err: string) => void) => ({
    stdin: {
      on: () => {},
      end: () => {
        const mails = Object.entries(h.tasks).map(([id, tasks]) => ({ id, tasks }))
        queueMicrotask(() => cb(null, JSON.stringify({ structured_output: { mails } }), ''))
      }
    }
  })
}))

const raw = (to: string, cc?: string, body = 'tresc', sent?: Date): Buffer =>
  Buffer.from(`From: me@x.pl\r\nTo: ${to}\r\n${cc ? `Cc: ${cc}\r\n` : ''}${sent ? `Date: ${sent.toUTCString()}\r\n` : ''}Subject: nota\r\n\r\n${body}\r\n`)

const BOXES = [
  { path: '[Gmail]/Wszystkie', specialUse: '\\All' },
  { path: '[Gmail]/Kosz', specialUse: '\\Trash' },
  { path: 'top5-zrzucone' }
]

function setup(
  msgs: Record<number, Buffer>,
  opts: { boxes?: unknown[]; move?: (uid: number) => Promise<unknown>; flag?: (uid: number) => Promise<unknown> } = {}
) {
  Object.assign(h.client, {
    on: vi.fn(),
    connect: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    close: vi.fn(),
    list: vi.fn(async () => opts.boxes ?? BOXES),
    mailboxCreate: vi.fn(),
    getMailboxLock: vi.fn(async () => ({ release: vi.fn() })),
    search: vi.fn(async () => Object.keys(msgs).map(Number)),
    fetchAll: vi.fn(async () => Object.entries(msgs).map(([uid, source]) => ({ uid: Number(uid), source, labels: new Set() }))),
    messageFlagsAdd: vi.fn(async (uid: number) => {
      h.calls.push(`label:${uid}`)
      return opts.flag ? opts.flag(uid) : true
    }),
    messageMove: vi.fn(async (uid: number) => {
      h.calls.push(`move:${uid}`)
      return opts.move ? opts.move(uid) : true
    })
  })
  const append = vi.fn((lines: string[]) => void h.calls.push(`append:${lines.join('|')}`))
  return append
}

beforeEach(() => {
  h.calls.length = 0
  h.tasks = {}
})

describe('pullMailTasks', () => {
  it('moves a mail with tasks to Trash after append and label', async () => {
    const append = setup({ 7: raw('me@x.pl') })
    h.tasks = { 7: ['kup mleko'] }
    expect(await pullMailTasks(append)).toEqual(['kup mleko'])
    expect(h.calls).toEqual(['append:kup mleko', 'label:7', 'move:7'])
    expect(h.client.messageFlagsAdd).toHaveBeenCalledWith(7, ['top5-zrzucone'], { uid: true, useLabels: true })
    expect(h.client.messageMove).toHaveBeenCalledWith(7, '[Gmail]/Kosz', { uid: true })
  })

  it('only labels a mail without tasks', async () => {
    const append = setup({ 8: raw('me@x.pl') })
    h.tasks = { 8: [] }
    expect(await pullMailTasks(append)).toEqual([])
    expect(h.calls).toEqual(['label:8'])
  })

  it('only labels a mail to someone else (Cc me), without asking the model', async () => {
    const append = setup({ 9: raw('other@y.pl', 'me@x.pl') })
    expect(await pullMailTasks(append)).toEqual([])
    expect(h.calls).toEqual(['label:9'])
  })

  it('only labels an unparseable mail', async () => {
    const append = setup({ 11: new Readable({ read() { this.destroy(new Error('bad')) } }) as never })
    expect(await pullMailTasks(append)).toEqual([])
    expect(h.calls).toEqual(['label:11'])
  })

  for (const [name, move] of [
    ['resolves false', async () => false],
    ['throws', async () => { throw new Error('boom') }]
  ] as const) {
    it(`keeps going and rejects when a move ${name}`, async () => {
      const append = setup({ 7: raw('me@x.pl'), 10: raw('me@x.pl') }, { move: (uid) => (uid === 7 ? move() : Promise.resolve(true)) })
      h.tasks = { 7: ['a'], 10: ['b'] }
      await expect(pullMailTasks(append)).rejects.toThrow(/\b1\b.*Kosz/)
      expect(h.calls).toEqual(['append:a', 'label:7', 'move:7', 'append:b', 'label:10', 'move:10'])
    })
  }

  it('counts every failed move in the error', async () => {
    const append = setup({ 7: raw('me@x.pl'), 10: raw('me@x.pl') }, { move: async () => false })
    h.tasks = { 7: ['a'], 10: ['b'] }
    await expect(pullMailTasks(append)).rejects.toThrow(/\b2\b/)
  })

  it('does not move a mail whose label failed', async () => {
    const append = setup({ 7: raw('me@x.pl') }, { flag: async () => false })
    h.tasks = { 7: ['a'] }
    await expect(pullMailTasks(append)).rejects.toThrow(/etykiety/)
    expect(h.client.messageMove).not.toHaveBeenCalled()
  })

  it('dryRun mutates nothing', async () => {
    // No label folder in the list — a non-dryRun run would create it.
    const append = setup({ 7: raw('me@x.pl'), 8: raw('me@x.pl') }, { boxes: [BOXES[0], BOXES[1]] })
    h.tasks = { 7: ['kup mleko'], 8: [] }
    expect(await pullMailTasks(append, true)).toEqual(['kup mleko'])
    expect(append).not.toHaveBeenCalled()
    expect(h.client.messageFlagsAdd).not.toHaveBeenCalled()
    expect(h.client.messageMove).not.toHaveBeenCalled()
    expect(h.client.mailboxCreate).not.toHaveBeenCalled()
    expect(h.client.getMailboxLock).toHaveBeenCalledWith('[Gmail]/Wszystkie', { readOnly: true })
  })

  it('labels but does not move a mail whose body was cut for the model', async () => {
    const append = setup({ 7: raw('me@x.pl', undefined, 'x'.repeat(4001)) })
    h.tasks = { 7: ['a'] }
    expect(await pullMailTasks(append)).toEqual(['a'])
    expect(h.calls).toEqual(['append:a', 'label:7'])
  })

  it('labels but does not move a mail with an attachment', async () => {
    const mime = Buffer.from(
      'From: me@x.pl\r\nTo: me@x.pl\r\nSubject: nota\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="b"\r\n\r\n' +
        '--b\r\nContent-Type: text/plain\r\n\r\nzaplacic\r\n' +
        '--b\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="f.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\nJVBERg==\r\n--b--\r\n'
    )
    const append = setup({ 7: mime })
    h.tasks = { 7: ['zaplacic'] }
    expect(await pullMailTasks(append)).toEqual(['zaplacic'])
    expect(h.calls).toEqual(['append:zaplacic', 'label:7'])
  })

  it('dryRun without a Trash folder is fine', async () => {
    const append = setup({ 7: raw('me@x.pl') }, { boxes: [BOXES[0], BOXES[2]] })
    h.tasks = { 7: ['a'] }
    expect(await pullMailTasks(append, true)).toEqual(['a'])
  })

  it('rejects before appending when Trash is missing', async () => {
    const append = setup({ 7: raw('me@x.pl') }, { boxes: [BOXES[0], BOXES[2]] })
    h.tasks = { 7: ['a'] }
    await expect(pullMailTasks(append)).rejects.toThrow(/\\Trash/)
    expect(append).not.toHaveBeenCalled()
  })
})

describe('parseMailTask', () => {
  const D = '2026-10-19'
  const p = (t: string, day = D) => parseMailTask(t, day)

  it('picks the section from a leading digit and removes it', () => {
    expect(p('1 zatankować samochód @2d #priv')).toEqual({ text: 'zatankować samochód @2026-10-21 #priv', section: 'Now' })
    expect(p('2 oddzwonić')).toEqual({ text: 'oddzwonić', section: 'Next' })
    expect(p('3 kupić mleko')).toEqual({ text: 'kupić mleko', section: 'Inbox' })
    expect(p('kupić mleko')).toEqual({ text: 'kupić mleko', section: 'Inbox' })
  })

  it('treats anything but a single digit 1-3 and a space as plain text', () => {
    for (const t of ['1. kupić mleko', '1) kupić mleko', '12 jajek', '4 x', '1x', '1']) {
      expect(p(t)).toEqual({ text: t, section: 'Inbox' })
    }
  })

  it('resolves relative dates from the sent day', () => {
    expect(p('x @0d').text).toBe('x @2026-10-19')
    expect(p('x @1w').text).toBe('x @2026-10-26')
    expect(p('x @2d', '2026-12-31').text).toBe('x @2027-01-02')
    expect(p('x @1m', '2026-01-31').text).toBe('x @2026-02-28')
    expect(p('x @1m', '2028-01-31').text).toBe('x @2028-02-29')
    expect(p('x @2m', '2026-12-15').text).toBe('x @2027-02-15')
    expect(p('x @13m', '2026-10-19').text).toBe('x @2027-11-19')
    expect(p('@1d x @1d').text).toBe('@2026-10-20 x @2026-10-20')
  })

  it('drops a `- ` / `+ ` marker right after the digit', () => {
    expect(p('1 + x')).toEqual({ text: 'x', section: 'Now' })
    expect(p('2 - x')).toEqual({ text: 'x', section: 'Next' })
  })

  it('leaves other @ tokens and #KOD alone', () => {
    for (const t of ['x @2026-10-21', 'x @jutro', 'x @2x', 'x @2D', 'mail@2d.pl', 'x @2dni', 'x #priv', 'x @10000d']) {
      expect(p(t)).toEqual({ text: t, section: 'Inbox' })
    }
  })
})

describe('pullMailTasks markers', () => {
  const sentAt = (h: number, m = 0) => new Date(2026, 9, 19, h, m)
  const run = async (sent: Date | undefined, tasks: string[], dump: string) => {
    setup({ 7: raw('me@x.pl', undefined, 'tresc', sent) })
    h.tasks = { 7: tasks }
    const append = vi.fn((lines: string[], section: string) => {
      dump = addOpenLines(dump, lines, section as 'Now')
    })
    const added = await pullMailTasks(append)
    return { dump, added, append }
  }
  afterEach(() => vi.useRealTimers())

  it('puts a dated task at the end of ## Now', async () => {
    const r = await run(sentAt(12), ['1 zatankować samochód @2d #priv'], '## Now\n\n- a\n\n## Next\n\n## Inbox\n\n- i\n')
    expect(r.dump).toBe('## Now\n\n- a\n- zatankować samochód @2026-10-21 #priv\n\n## Next\n\n## Inbox\n\n- i\n')
  })

  it('splits one mail between sections, in order Now, Next, Inbox', async () => {
    const r = await run(sentAt(12), ['3 c', '1 a', 'd', '2 b'], '## Now\n\n## Next\n\n## Inbox\n\n- i\n')
    expect(r.append.mock.calls).toEqual([[['a'], 'Now'], [['b'], 'Next'], [['c', 'd'], 'Inbox']])
    expect(r.added).toEqual(['a', 'b', 'c', 'd'])
    expect(r.dump).toBe('## Now\n\n- a\n\n## Next\n\n- b\n\n## Inbox\n\n- c\n- d\n- i\n')
  })

  it('counts a mail sent at 01:30 as the previous day', async () => {
    const r = await run(sentAt(1, 30), ['x @0d'], '## Inbox\n')
    expect(r.dump).toBe('## Inbox\n\n- x @2026-10-18\n')
  })

  it('uses today (logical day) when the mail has no Date header', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 10, 3, 0))
    const r = await run(undefined, ['x @1d'], '## Inbox\n')
    expect(r.dump).toBe('## Inbox\n\n- x @2026-06-10\n')
  })

  it('dryRun returns the final lines without appending', async () => {
    setup({ 7: raw('me@x.pl', undefined, 'tresc', sentAt(12)) })
    h.tasks = { 7: ['2 b @1d'] }
    const append = vi.fn()
    expect(await pullMailTasks(append, true)).toEqual(['b @2026-10-20'])
    expect(append).not.toHaveBeenCalled()
  })
})
