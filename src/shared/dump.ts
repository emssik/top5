// "Zrzut" (dump.md) text helpers — pure, shared by the renderer (⌘D, counter)
// and the main-process service (API append). Convention: `- ` open, `+ ` done.

export const DONE_HEADER = '## Zrobione'

// mtime = file mtime in integer ms, null when dump.md doesn't exist yet.
export type DumpState = { text: string; mtime: number | null }
export type DumpError = { error: 'invalid' | 'too_large' | 'conflict' }
// Result of pulling tasks from self-sent mails (src/main/mail-to-dump.ts).
export type MailToDumpResult = { ok: true; added: number } | { ok: false; error: string }

const isOpen = (line: string): boolean => line.trimStart().startsWith('- ')
const isDone = (line: string): boolean => line.trimStart().startsWith('+ ')
const isHeader = (line: string): boolean => line.trim() === DONE_HEADER

export function countDumpLines(text: string): { open: number; done: number } {
  let open = 0
  let done = 0
  for (const line of text.split('\n')) {
    if (isOpen(line)) open++
    else if (isDone(line)) done++
  }
  return { open, done }
}

// Index where new open lines go: right above `## Zrobione` (before the blank lines
// separating it), or at the end of the text (before trailing blank lines).
function openInsertIndex(lines: string[]): number {
  const header = lines.findIndex(isHeader)
  let i = header === -1 ? lines.length : header
  while (i > 0 && lines[i - 1].trim() === '') i--
  return i
}

export function appendOpenLine(text: string, line: string): string {
  const lines = text.split('\n')
  const entry = /^[-+] /.test(line) ? line : `- ${line}`
  lines.splice(openInsertIndex(lines), 0, entry)
  return lines.join('\n')
}

// Save conflict (409): if the file only gained open lines since `base` (mail sync, API/CLI
// append), returns `mine` with those lines appended the same way; null = a real conflict.
export function mergeExternalAppends(base: string, theirs: string, mine: string): string | null {
  const baseLines = base.split('\n')
  const added: string[] = []
  let i = 0
  for (const line of theirs.split('\n')) {
    if (i < baseLines.length && line === baseLines[i]) i++
    else added.push(line)
  }
  if (i < baseLines.length || !added.every(isOpen)) return null
  return added.reduce((text, line) => appendOpenLine(text, line.trim()), mine)
}

// A line that continues the item above it (plain text, not a new item / header / blank).
const isContinuation = (line: string): boolean => {
  const t = line.trim()
  return t !== '' && !t.startsWith('#') && !isOpen(line) && !isDone(line)
}

// Item = `- x` / `+ x` line plus the plain-text lines right below it. Plain text with
// no item above (e.g. at the top of the file) forms an item on its own.
function itemRange(lines: string[], i: number): [number, number] {
  let start = i
  if (isContinuation(lines[i])) {
    while (start > 0 && isContinuation(lines[start - 1])) start--
    if (start > 0 && (isOpen(lines[start - 1]) || isDone(lines[start - 1]))) start--
  }
  let end = start
  while (end + 1 < lines.length && isContinuation(lines[end + 1])) end++
  return [start, end]
}

// Title of the open item starting at line i (its first line without `- `), or null
// when line i isn't the head of an open item. Links a dump item to a quick task (⌘F).
function openItemTitle(lines: string[], i: number): string | null {
  const t = lines[i].trim()
  if (t === '' || t.startsWith('#') || isDone(lines[i])) return null
  // Plain text right below an item / other plain text continues it — not a head. O(1), no itemRange scan.
  if (!isOpen(lines[i]) && i > 0 && (isContinuation(lines[i - 1]) || isOpen(lines[i - 1]) || isDone(lines[i - 1]))) return null
  return (isOpen(lines[i]) ? t.slice(2) : t).trim() || null
}

// ⌘F: title of the open item under the cursor.
export function dumpItemTitle(text: string, pos: number): string | null {
  const lines = text.split('\n')
  const i = text.slice(0, pos).split('\n').length - 1
  return openItemTitle(lines, itemRange(lines, i)[0])
}

// Marks the first open item titled `title` as done (same as ⌘D); null when there's none.
// ponytail: powiązanie po tekście — zmiana tytułu linii/taska je zrywa; ukryty identyfikator w linii, jeśli zacznie boleć
export function completeDumpItem(text: string, title: string, date: string): string | null {
  const lines = text.split('\n')
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    if (openItemTitle(lines, i) === title.trim()) return toggleDumpLines(text, pos, pos, date)?.text ?? null
    pos += lines[i].length + 1
  }
  return null
}

/**
 * ⌘D: toggles every item touched by the selection [selStart, selEnd] — the whole
 * item, including its continuation lines.
 * Open (`- x` or plain text) → removed and appended at the end of the file as
 * `+ <date> x` under `## Zrobione` (header created if missing).
 * Done (`+ <date> x` / `+ x`) → `- x`, moved to the end of the open list.
 * Returns null when there is nothing to toggle.
 */
export function toggleDumpLines(
  text: string,
  selStart: number,
  selEnd: number,
  date: string
): { text: string; cursor: number } | null {
  const lines = text.split('\n')
  const lineAt = (pos: number): number => text.slice(0, pos).split('\n').length - 1
  const first = lineAt(selStart)
  let last = lineAt(selEnd)
  // Selection ending at column 0 of the next line doesn't include that line.
  if (selEnd > selStart && text[selEnd - 1] === '\n') last--

  const items: [number, number][] = []
  for (let i = first; i <= last; i++) {
    const trimmed = lines[i].trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const range = itemRange(lines, i)
    if (items.length === 0 || items[items.length - 1][0] !== range[0]) items.push(range)
  }
  if (items.length === 0) return null

  const reopened: string[] = []
  const completed: string[] = []
  const moved = new Set<number>()
  for (const [start, end] of items) {
    const line = lines[start].trimStart()
    const indent = lines[start].slice(0, lines[start].length - line.length)
    const rest = lines.slice(start + 1, end + 1)
    for (let i = start; i <= end; i++) moved.add(i)
    if (isDone(line)) {
      reopened.push(`${indent}- ${line.slice(2).replace(/^\d{4}-\d{2}-\d{2}\s+/, '')}`, ...rest)
    } else {
      completed.push(`${indent}+ ${date} ${isOpen(line) ? line.slice(2) : line}`, ...rest)
    }
  }

  const result = lines.filter((_, i) => !moved.has(i))
  // Cursor lands on the line that took the place of the first moved one.
  let cursorLine = items[0][0]

  if (reopened.length > 0) {
    const at = openInsertIndex(result)
    result.splice(at, 0, ...reopened)
    if (at <= cursorLine) cursorLine += reopened.length
  }

  if (completed.length > 0) {
    const trailingNewline = text.endsWith('\n')
    while (result.length > 0 && result[result.length - 1].trim() === '') result.pop()
    if (!result.some(isHeader)) {
      if (result.length > 0) result.push('')
      result.push(DONE_HEADER)
    }
    result.push(...completed)
    if (trailingNewline) result.push('')
  }

  cursorLine = Math.min(cursorLine, result.length - 1)
  let cursor = 0
  for (let i = 0; i < cursorLine; i++) cursor += result[i].length + 1
  return { text: result.join('\n'), cursor }
}
