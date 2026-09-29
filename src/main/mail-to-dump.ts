import type { IpcMain } from 'electron'
import { IS_DEV, notifyAllWindows } from './store'
import { appendDumpLine } from './service/dump'
import { pullMailTasks } from './service/mail-inbox'
import type { MailToDumpResult } from '../shared/dump'

// Tasks from self-sent mails → end of the dump. Runs at startup, every 30 min and on
// demand (✉ button in the dump view). Mail logic lives in service/mail-inbox.ts.

const INTERVAL_MS = 30 * 60_000

let running: Promise<MailToDumpResult> | null = null

export function runMailToDump(): Promise<MailToDumpResult> {
  // Dev would label the real mailbox's mail while appending to the dev dump — the ✉ button too.
  if (IS_DEV) return Promise.resolve({ ok: false, error: 'wyłączone w trybie dev' })
  let appended = false
  running ??= pullMailTasks((line) => {
    const result = appendDumpLine(line)
    // Throw so the mail isn't labelled — it comes back next run.
    if ('error' in result) throw new Error(`zrzut: ${result.error}`)
    appended = true
  })
    .then((added): MailToDumpResult => ({ ok: true, added: added.length }))
    .catch((err: unknown): MailToDumpResult => {
      const error = err instanceof Error ? err.message : String(err)
      console.error('[mail-to-dump]', error)
      return { ok: false, error }
    })
    .finally(() => {
      running = null
      if (appended) notifyAllWindows() // also after a partial failure — some lines may already be in
    })
  return running
}

export function startMailToDump(): void {
  if (IS_DEV) return
  void runMailToDump()
  setInterval(() => void runMailToDump(), INTERVAL_MS)
}

export function registerMailToDumpHandlers(ipc: IpcMain): void {
  ipc.handle('mail-to-dump', () => runMailToDump())
}
