import { readFileSync, writeFileSync, renameSync, statSync, utimesSync } from 'fs'
import { join } from 'path'
import { getConfigDir } from '../store'
import { appendOpenLine, completeDumpItem } from '../../shared/dump'
import { logicalDateKey } from '../../shared/schedule'
import type { DumpState, DumpError } from '../../shared/dump'

// "Zrzut" — a single plain-text file next to data.yaml. Every write is guarded by
// mtime (optimistic lock) so the UI and an external model can't overwrite each other.

export const MAX_DUMP_BYTES = 1_000_000

function dumpFile(): string {
  return join(getConfigDir(), 'dump.md')
}

// Integer ms (null = no file yet) — survives JSON / shell round-trips exactly.
function currentMtime(): number | null {
  try {
    return Math.trunc(statSync(dumpFile()).mtimeMs)
  } catch {
    return null
  }
}

export function getDump(): DumpState {
  const mtime = currentMtime()
  return { text: mtime === null ? '' : readFileSync(dumpFile(), 'utf-8'), mtime }
}

function writeDump(text: string): DumpState {
  const file = dumpFile()
  const tmp = `${file}.tmp`
  const before = currentMtime()
  writeFileSync(tmp, text, 'utf-8')
  renameSync(tmp, file)
  // Two writes within the same ms would share an mtime and a stale baseMtime would
  // pass the lock — force every write to advance mtime by at least 1 ms.
  const after = currentMtime()
  if (before !== null && after !== null && after <= before) {
    // Seconds as float lose sub-ms precision (x.800 → x.799999), so aim mid-ms.
    const bumped = (before + 1.5) / 1000
    utimesSync(file, bumped, bumped)
  }
  return { text, mtime: currentMtime() }
}

export function saveDump(text: unknown, baseMtime: unknown): DumpState | DumpError {
  if (typeof text !== 'string') return { error: 'invalid' }
  if (baseMtime !== null && (typeof baseMtime !== 'number' || !Number.isFinite(baseMtime))) return { error: 'invalid' }
  if (Buffer.byteLength(text, 'utf-8') > MAX_DUMP_BYTES) return { error: 'too_large' }
  if (currentMtime() !== baseMtime) return { error: 'conflict' }
  return writeDump(text)
}

// Additive — no baseMtime needed; the read-modify-write is synchronous in main.
export function appendDumpLine(line: unknown): DumpState | DumpError {
  if (typeof line !== 'string' || line.trim() === '' || /[\r\n]/.test(line)) return { error: 'invalid' }
  const text = appendOpenLine(getDump().text, line.trim())
  if (Buffer.byteLength(text, 'utf-8') > MAX_DUMP_BYTES) return { error: 'too_large' }
  return writeDump(text)
}

// A quick task started from the dump (⌘F) was completed — tick off its dump line.
// Never throws: completing the task must not fail because of the dump.
export function completeDumpItemByTitle(title: string): void {
  try {
    const text = completeDumpItem(getDump().text, title, logicalDateKey())
    if (text !== null && Buffer.byteLength(text, 'utf-8') <= MAX_DUMP_BYTES) writeDump(text)
  } catch (err) {
    console.error('[dump] failed to mark item done:', err)
  }
}
