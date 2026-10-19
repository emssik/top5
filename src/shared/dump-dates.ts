// Dates in the dump: an item carries `@YYYY-MM-DD` on its first line. Pure text helpers.
import { DATE_TOKEN_RE, cursorAt, itemRange, lineAt, openItemTitle, sectionBounds, stripDumpDates } from './dump'
import { DAYS } from './dump-repeat'

const DAY_MS = 86_400_000

const toMs = (key: string): number => Date.parse(`${key}T00:00:00Z`)
const addDays = (key: string, n: number): string => new Date(toMs(key) + n * DAY_MS).toISOString().slice(0, 10)

// Exact date or null for an impossible one (31.02).
function ymd(y: number, m: number, d: number): string | null {
  const key = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const ms = toMs(key)
  return !isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === key ? key : null
}

export function parseDumpDate(input: string, today: string, base?: string): string | null {
  const s = input.trim().toLowerCase()
  if (s === 'dziś' || s === 'dzis') return today
  if (s === 'jutro') return addDays(today, 1)
  if (s === 'pojutrze') return addDays(today, 2)
  // At most 4 digits: a bigger shift leaves the 4-digit years (garbage token) or overflows Date (RangeError in render).
  const rel = /^\+([1-9]\d{0,3})([dw])$/.exec(s)
  if (rel) return addDays(base ?? today, Number(rel[1]) * (rel[2] === 'w' ? 7 : 1))
  // A Map, not `in` on an object: `constructor` would match Object.prototype and throw.
  const weekday = DAYS.get(s)
  if (weekday !== undefined) {
    const current = new Date(toMs(today)).getUTCDay()
    return addDays(today, ((weekday - current + 6) % 7) + 1)
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) return ymd(+iso[1], +iso[2], +iso[3])
  const dm = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/.exec(s)
  if (!dm) return null
  if (dm[3]) return ymd(+dm[3], +dm[2], +dm[1])
  const year = Number(today.slice(0, 4))
  const date = ymd(year, +dm[2], +dm[1])
  return date !== null && date < today ? ymd(year + 1, +dm[2], +dm[1]) : date
}

export type DumpDateToken = { start: number; end: number; date: string }

// Date tokens of one line (offsets within the line); none on `#` lines.
function lineDates(line: string): DumpDateToken[] {
  if (line.trimStart().startsWith('#')) return []
  return [...line.matchAll(DATE_TOKEN_RE)].map((m) => {
    const lead = m[0].length - m[0].trimStart().length
    return { start: m.index + lead, end: m.index + m[0].length, date: m[0].slice(lead + 1) }
  })
}

// Only an item's first line carries its date: a token on a note line below it doesn't count.
const isItemHead = (lines: string[], i: number): boolean => itemRange(lines, i)[0] === i

// The token containing `pos` strictly inside (start < pos < end). Scans only the caret's line (runs on every caret move).
export function dumpDateAt(text: string, pos: number): DumpDateToken | null {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1
  const lineEnd = text.indexOf('\n', pos)
  const t = lineDates(text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)).find((d) => lineStart + d.start < pos && pos < lineStart + d.end)
  if (!t || !isItemHead(text.split('\n'), lineAt(text, pos))) return null
  return { start: lineStart + t.start, end: lineStart + t.end, date: t.date }
}

export function findDumpDates(text: string): DumpDateToken[] {
  const lines = text.split('\n')
  const tokens: DumpDateToken[] = []
  let offset = 0
  lines.forEach((line, i) => {
    const found = lineDates(line)
    if (found.length && isItemHead(lines, i)) for (const t of found) tokens.push({ ...t, start: offset + t.start, end: offset + t.end })
    offset += line.length + 1
  })
  return tokens
}

// Picker trigger: caret right behind ` @query` in a line that isn't a comment / header.
export function dumpDateTrigger(text: string, caret: number): { start: number; query: string } | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1
  const before = text.slice(lineStart, caret)
  const m = /[ \t]@([\p{L}\p{N}+.-]*)$/u.exec(before)
  if (!m || before.trimStart().startsWith('#')) return null
  return { start: lineStart + m.index + 1, query: m[1] }
}

// Date on the first line of the item under `pos`, if any.
export function itemDumpDate(text: string, pos: number): string | undefined {
  const lines = text.split('\n')
  return lineDates(lines[itemRange(lines, lineAt(text, pos))[0]])[0]?.date
}

// A date-only item (`- @date`) keeps its `- ` / `+ ` marker when the date goes: a bare `-` is no longer an item.
const BARE_MARKER = /^[ \t]*[-+]$/

// Backspace right behind a token: drops it with its leading space (but not the marker's space).
export function dropDumpDate(text: string, t: DumpDateToken): { text: string; cursor: number } {
  const lineStart = text.lastIndexOf('\n', t.start - 1) + 1
  const from = BARE_MARKER.test(text.slice(lineStart, t.start - 1)) ? t.start : t.start - 1
  return { text: text.slice(0, from) + text.slice(t.end), cursor: from }
}

// Puts `@date` at the end of the first line of the item under `pos` (replacing its dates); null date = remove.
export function setDumpItemDate(text: string, pos: number, date: string | null): { text: string; cursor: number } | null {
  const lines = text.split('\n')
  const first = itemRange(lines, lineAt(text, pos))[0]
  const line = lines[first]
  if (line.trim() === '' || line.trimStart().startsWith('#')) return null
  const stripped = line.replace(DATE_TOKEN_RE, '').trimEnd()
  const next = date ? `${stripped} @${date}` : BARE_MARKER.test(stripped) ? `${stripped} ` : stripped
  const start = cursorAt(lines, first)
  const oldEnd = start + line.length
  lines[first] = next
  const newEnd = start + next.length
  return { text: lines.join('\n'), cursor: pos >= oldEnd ? pos + newEnd - oldEnd : Math.min(pos, newEnd) }
}

export type DatedDumpItem = { pos: number; title: string; date: string }

// Open items with a date, outside `## Now`, by date then text order.
export function datedDumpItems(text: string): DatedDumpItem[] {
  const lines = text.split('\n')
  const now = sectionBounds(lines, 'Now')
  const items: DatedDumpItem[] = []
  let pos = 0
  lines.forEach((line, i) => {
    const title = openItemTitle(lines, i)
    const date = lineDates(line)[0]?.date
    if (title !== null && date && !(now && i > now[0] && i < now[1])) {
      items.push({ pos, title: stripDumpDates(title), date })
    }
    pos += line.length + 1
  })
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
