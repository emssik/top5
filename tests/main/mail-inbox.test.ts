import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import { pullMailTasks } from '../../src/main/service/mail-inbox'

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

const raw = (to: string, cc?: string, body = 'tresc'): Buffer =>
  Buffer.from(`From: me@x.pl\r\nTo: ${to}\r\n${cc ? `Cc: ${cc}\r\n` : ''}Subject: nota\r\n\r\n${body}\r\n`)

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
