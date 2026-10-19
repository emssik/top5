// "Zrzut" (dump.md) text helpers — pure, shared by the renderer (⌘D, counter)
// and the main-process service (API append). Convention: `- ` open, `+ ` done.
// Optional sections: `## Now`, `## Next`, `## Inbox` (new lines land on top), `## Done`.

export const DONE_HEADER = '## Done'
export type DumpSection = 'Now' | 'Next' | 'Inbox'

// mtime = file mtime in integer ms, null when dump.md doesn't exist yet.
export type DumpState = { text: string; mtime: number | null }
export type DumpError = { error: 'invalid' | 'too_large' | 'conflict' }
// Result of pulling tasks from self-sent mails (src/main/mail-to-dump.ts).
export type MailToDumpResult = { ok: true; added: number } | { ok: false; error: string }

const isOpen = (line: string): boolean => line.trimStart().startsWith('- ')
const isDone = (line: string): boolean => line.trimStart().startsWith('+ ')
// `## Zrobione` = the done header from before the sections.
const isHeader = (line: string): boolean => /^##\s+(Done|Zrobione)(\s|$)/i.test(line.trim())
const isSectionHeader = (line: string): boolean => /^##\s/.test(line.trim())

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

// Header index of section `name` and the index where it ends (next `## ` header / EOF); null = no section.
export function sectionBounds(lines: string[], name: string): [number, number] | null {
  const re = new RegExp(`^##\\s+${name}(\\s|$)`, 'i')
  const h = lines.findIndex((l) => re.test(l.trim()))
  if (h === -1) return null
  let n = h + 1
  while (n < lines.length && !isSectionHeader(lines[n])) n++
  return [h, n]
}

// Inserts `block` at the end of `## Now` / `## Next` or the top of `## Inbox`, one blank line below the header.
// Returns [index, number of lines inserted], null when there's no such section.
function insertInSection(lines: string[], name: DumpSection, block: string[]): [number, number] | null {
  const bounds = sectionBounds(lines, name)
  if (!bounds) return null
  const [h, n] = bounds
  const blank = (k: number): boolean => lines[k].trim() === ''
  let i = h + 1
  if (name === 'Inbox') {
    while (i < n && blank(i)) i++
    if (i === n) i = h + 1
  } else {
    i = n
    while (i > h + 1 && blank(i - 1)) i--
  }
  const inserted = i === h + 1 ? ['', ...block] : block
  lines.splice(i, 0, ...inserted)
  return [i, inserted.length]
}

// New lines (mail, API/CLI append): end of `## Now` / `## Next` or top of `## Inbox` (the default); a missing
// section → top of `## Inbox`, or the end of the open list when there's no Inbox either.
export function addOpenLines(text: string, entries: string[], section: DumpSection = 'Inbox'): string {
  const lines = text.split('\n')
  const block = entries.map((line) => (/^[-+] /.test(line) ? line : `- ${line}`))
  const placed = insertInSection(lines, section, block) || insertInSection(lines, 'Inbox', block)
  if (!placed) lines.splice(openInsertIndex(lines), 0, ...block)
  return lines.join('\n')
}

// Save conflict (409): if the file only gained open lines since `base` (mail sync, API/CLI
// append), returns `mine` with those lines added the same way; null = a real conflict.
export function mergeExternalAppends(base: string, theirs: string, mine: string): string | null {
  const baseLines = base.split('\n')
  const added: string[] = []
  let i = 0
  for (const line of theirs.split('\n')) {
    if (i < baseLines.length && line === baseLines[i]) i++
    // Blank lines come with the first line in an empty Inbox — addOpenLines re-adds them.
    else if (line.trim() !== '') added.push(line)
  }
  if (i < baseLines.length || !added.every(isOpen)) return null
  // ponytail: wiersze z maila (Now/Next) lądują tu na górze Inboxa — zachowanie sekcji, jeśli zacznie przeszkadzać
  return added.length ? addOpenLines(mine, added.map((line) => line.trim())) : mine
}

// Index of the line that holds text position `pos`.
export const lineAt = (text: string, pos: number): number => text.slice(0, pos).split('\n').length - 1

// A line that continues the item above it (plain text, not a new item / header / blank).
const isContinuation = (line: string): boolean => {
  const t = line.trim()
  return t !== '' && !t.startsWith('#') && !isOpen(line) && !isDone(line)
}

// Item = `- x` / `+ x` line plus the plain-text lines right below it. Plain text with
// no item above (e.g. at the top of the file) forms an item on its own.
export function itemRange(lines: string[], i: number): [number, number] {
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
export function openItemTitle(lines: string[], i: number): string | null {
  const t = lines[i].trim()
  if (t === '' || t.startsWith('#') || isDone(lines[i])) return null
  // Plain text right below an item / other plain text continues it — not a head. O(1), no itemRange scan.
  if (!isOpen(lines[i]) && i > 0 && (isContinuation(lines[i - 1]) || isOpen(lines[i - 1]) || isDone(lines[i - 1]))) return null
  return (isOpen(lines[i]) ? t.slice(2) : t).trim() || null
}

// `#KOD` tags: `#` + code after a space/tab, never at the start of the line (that's a comment/header).
// A tag in a title is `#` + letter first, so `#123` (issue numbers) stays plain text.
const TAG_RE = /[ \t]#(\p{L}[\p{L}\p{N}]*)/gu
export type DumpTag = { start: number; end: number; code: string }

// Tags of known project `codes` (case-insensitive); `code` is the spelling from `codes`.
export function findDumpTags(text: string, codes: string[]): DumpTag[] {
  const byLower = new Map(codes.map((c) => [c.toLowerCase(), c]))
  const tags: DumpTag[] = []
  let offset = 0
  for (const line of text.split('\n')) {
    if (!line.trimStart().startsWith('#')) {
      for (const m of line.matchAll(TAG_RE)) {
        const code = byLower.get(m[1].toLowerCase())
        if (code) tags.push({ start: offset + m.index + 1, end: offset + m.index + m[0].length, code })
      }
    }
    offset += line.length + 1
  }
  return tags
}

const HASHTAG_RE = /(^|[ \t]+)#(\p{L}[\p{L}\p{N}]*)/gu

// Title without its project tags (`codes`, case-insensitive); other hashtags (`#pilne`) stay.
// A title may start with a tag (`- #ATD Oferta` → `#ATD Oferta`); callers never pass `#` comment lines.
// Also drops `@YYYY-MM-DD` dates: like project tags, they are item metadata, not part of the title.
export function stripDumpTags(title: string, codes: string[]): string {
  return stripDumpDates(stripTags(title, codes))
}

// `@YYYY-MM-DD` (dump-dates.ts) with the whitespace before it; the token ends at whitespace / end of line.
export const DATE_TOKEN_RE = /[ \t]+@\d{4}-\d{2}-\d{2}(?=\s|$)/g

// Item title without its date tokens — also one at the title's start (`- @2026-10-17 X` → `X`).
export const stripDumpDates = (title: string): string => title.replace(/(^|[ \t]+)@\d{4}-\d{2}-\d{2}(?=\s|$)/g, '').trim()

const stripTags = (title: string, codes: string[]): string => {
  const known = new Set(codes.map((c) => c.toLowerCase()))
  return title.replace(HASHTAG_RE, (all, _lead, word: string) => (known.has(word.toLowerCase()) ? '' : all)).trim()
}

// dump↔quick-task matching key: main doesn't know the project codes, so every hashtag is dropped
// on both sides — `- Napraw #pilne #ATD` ↔ task `Napraw #pilne` (⌘F keeps non-project hashtags).
const matchKey = (title: string): string => stripDumpDates(title).replace(HASHTAG_RE, '').trim()
const hashtags = (title: string): string[] => [...title.matchAll(HASHTAG_RE)].map((m) => m[2].toLowerCase())

// ⌘P: puts `#code` at the end of the first line of the item under `pos` (replacing its tags).
export function setDumpItemTag(text: string, pos: number, code: string, codes: string[]): { text: string; cursor: number } | null {
  const lines = text.split('\n')
  const first = itemRange(lines, lineAt(text, pos))[0]
  const line = lines[first]
  if (line.trim() === '' || line.trimStart().startsWith('#')) return null
  const indent = line.slice(0, line.length - line.trimStart().length)
  const next = `${indent}${stripTags(line.trimEnd(), codes)} #${code}`
  const start = cursorAt(lines, first)
  const oldEnd = start + line.length
  lines[first] = next
  const newEnd = start + next.length
  return { text: lines.join('\n'), cursor: pos >= oldEnd ? pos + newEnd - oldEnd : Math.min(pos, newEnd) }
}

// Picker trigger: caret right behind ` #query` in a line that isn't a comment / header.
export function projectTagTrigger(text: string, caret: number): { start: number; query: string } | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1
  const before = text.slice(lineStart, caret)
  const m = /[ \t]#([\p{L}\p{N}]*)$/u.exec(before)
  if (!m || before.trimStart().startsWith('#')) return null
  return { start: lineStart + m.index + 1, query: m[1] }
}

// Open items in `## <section>`.
export function countSectionOpen(text: string, section: DumpSection): number {
  const lines = text.split('\n')
  const bounds = sectionBounds(lines, section)
  return bounds ? lines.slice(bounds[0] + 1, bounds[1]).filter(isOpen).length : 0
}

// ⌘F: title of the open item under the cursor.
export function dumpItemTitle(text: string, pos: number): string | null {
  const lines = text.split('\n')
  return openItemTitle(lines, itemRange(lines, lineAt(text, pos))[0])
}

// Marks the first open item titled `title` as done (same as ⌘D); null when there's none.
// ponytail: powiązanie po tekście — zmiana tytułu linii/taska je zrywa; ukryty identyfikator w linii, jeśli zacznie boleć
export function completeDumpItem(text: string, title: string, date: string): string | null {
  const pos = findDumpItem(text, title)
  return pos === null ? null : toggleDumpLines(text, pos, pos, date)?.text ?? null
}

// Position of the first open item titled `title`; null when there's none.
export function findDumpItem(text: string, title: string): number | null {
  const want = matchKey(title)
  // A tags-only title would match every tags-only item.
  if (!want) return null
  // The title's own hashtags must be on the line too: task `Napraw #jutro` ≠ line `- Napraw #pilne`.
  const wantTags = hashtags(title)
  const lines = text.split('\n')
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    const t = openItemTitle(lines, i)
    if (t !== null && matchKey(t) === want && wantTags.every((tag) => hashtags(t).includes(tag))) return pos
    pos += lines[i].length + 1
  }
  return null
}

// Items ([start, end] line ranges) touched by the selection [selStart, selEnd].
function selectedItems(text: string, lines: string[], selStart: number, selEnd: number): [number, number][] {
  const first = lineAt(text, selStart)
  let last = lineAt(text, selEnd)
  // Selection ending at column 0 of the next line doesn't include that line.
  if (selEnd > selStart && text[selEnd - 1] === '\n') last--

  const items: [number, number][] = []
  for (let i = first; i <= last; i++) {
    const trimmed = lines[i].trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const range = itemRange(lines, i)
    if (items.length === 0 || items[items.length - 1][0] !== range[0]) items.push(range)
  }
  return items
}

const reopen = (line: string): string => line.replace(/^(\s*)\+ (?:\d{4}-\d{2}-\d{2}\s+)?/, '$1- ')

// Drops the moved lines; a blank line doubled by the removal goes too (the file's final newline stays).
function withoutLines(lines: string[], moved: Set<number>): string[] {
  const out: string[] = []
  lines.forEach((line, i) => {
    if (moved.has(i)) return
    const doubled = line.trim() === '' && moved.has(i - 1) && i < lines.length - 1 && out.length > 0 && out[out.length - 1].trim() === ''
    if (!doubled) out.push(line)
  })
  return out
}

export function cursorAt(lines: string[], line: number): number {
  let cursor = 0
  for (let i = 0; i < Math.min(line, lines.length - 1); i++) cursor += lines[i].length + 1
  return cursor
}

/**
 * ⌘1 / ⌘2 / ⌘3 (and ⌘F → Now): moves every item touched by the selection to the end of
 * `## Now` / `## Next`, or the top of `## Inbox`; a done item is reopened. Items already in that section stay put.
 * Returns null when the section doesn't exist or there is nothing to move.
 */
export function moveDumpItems(
  text: string,
  selStart: number,
  selEnd: number,
  section: DumpSection
): { text: string; cursor: number } | null {
  const lines = text.split('\n')
  const bounds = sectionBounds(lines, section)
  if (!bounds) return null
  const items = selectedItems(text, lines, selStart, selEnd).filter(([start]) => start < bounds[0] || start >= bounds[1])
  if (items.length === 0) return null

  const block: string[] = []
  const moved = new Set<number>()
  for (const [start, end] of items) {
    block.push(isDone(lines[start]) ? reopen(lines[start]) : lines[start], ...lines.slice(start + 1, end + 1))
    for (let i = start; i <= end; i++) moved.add(i)
  }
  const result = withoutLines(lines, moved)
  // Cursor stays where the first moved item was — the next item to sort through.
  let cursorLine = items[0][0]
  const [at, count] = insertInSection(result, section, block)!
  if (at <= cursorLine) cursorLine += count
  return { text: result.join('\n'), cursor: cursorAt(result, cursorLine) }
}

/**
 * ⌘D: toggles every item touched by the selection [selStart, selEnd] — the whole
 * item, including its continuation lines.
 * Open (`- x` or plain text) → removed and put on top of `## Done` as `+ <date> x`
 * (header created at the end of the file if missing).
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
  const items = selectedItems(text, lines, selStart, selEnd)
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
      reopened.push(reopen(lines[start]), ...rest)
    } else {
      completed.push(`${indent}+ ${date} ${isOpen(line) ? line.slice(2) : line}`, ...rest)
    }
  }

  const result = withoutLines(lines, moved)
  // Cursor lands on the line that took the place of the first moved one.
  let cursorLine = items[0][0]

  if (reopened.length > 0) {
    const at = openInsertIndex(result)
    result.splice(at, 0, ...reopened)
    if (at <= cursorLine) cursorLine += reopened.length
  }

  if (completed.length > 0) {
    const h = result.findIndex(isHeader)
    if (h === -1) {
      const trailingNewline = text.endsWith('\n')
      while (result.length > 0 && result[result.length - 1].trim() === '') result.pop()
      if (result.length > 0) result.push('')
      result.push(DONE_HEADER, ...completed)
      if (trailingNewline) result.push('')
    } else {
      // Newest on top: above the first line of the section, keeping the blank lines under the header.
      let at = h + 1
      while (at < result.length && result[at].trim() === '') at++
      if (at === result.length || isSectionHeader(result[at])) at = h + 1
      result.splice(at, 0, ...completed)
      if (at <= cursorLine) cursorLine += completed.length
    }
  }

  return { text: result.join('\n'), cursor: cursorAt(result, cursorLine) }
}

export type DumpSectionHeader = { start: number; end: number }

/** `## Title` lines (exactly `## ` at column 0, non-empty title), in text order. */
export function findDumpSectionHeaders(text: string): DumpSectionHeader[] {
  const headers: DumpSectionHeader[] = []
  let start = 0
  for (const line of text.split('\n')) {
    if (line.startsWith('## ') && line.slice(3).trim()) headers.push({ start, end: start + line.length })
    start += line.length + 1
  }
  return headers
}

// The section around `pos`: from its `## ` header (or 0 before the first one) to the next header / EOF.
export function dumpCurrentSection(text: string, pos: number): { from: number; to: number } | null {
  const headers = findDumpSectionHeaders(text)
  if (!headers.length) return null
  const p = Math.min(Math.max(pos, 0), text.length)
  const i = headers.findLastIndex((h) => h.start <= p)
  return { from: i < 0 ? 0 : headers[i].start, to: headers[i + 1]?.start ?? (i < 0 ? headers[0].start : text.length) }
}

// Wrap alignment of one line, in characters: item = continuation indent, header = how far the `## ` hangs
// into the margin, plain = the line's own leading whitespace (wrapped text keeps its indent).
export type DumpLineHang = { kind: 'header' | 'item' | 'plain'; hang: number }

export function dumpLineHang(line: string): DumpLineHang {
  if (line.startsWith('## ') && line.slice(3).trim()) return { kind: 'header', hang: 3 }
  const indent = line.length - line.trimStart().length
  if (/^[-+] /.test(line.slice(indent))) return { kind: 'item', hang: indent + 2 }
  // `* x` = a sub-point inside an item (a note, not a task): wraps under its text, not its star.
  return { kind: 'plain', hang: line.startsWith('* ', indent) ? indent + 2 : indent }
}

const LIST_MARKER = /^\s*(?:[-*•+]|\d+[.)])\s+/

/**
 * ⌘V of several lines into the dump, as the text to insert instead of `pasted`; null = paste as is.
 * `before` / `after` = the caret line's text before / after the pasted range. Blank lines are dropped
 * (a blank line would end the item) and foreign list markers become `* ` sub-points:
 * - on an empty line: first line → a new `- ` item, the rest → its sub-points (text already in dump form,
 *   starting with `- ` / `+ ` / `#`, is pasted as is — e.g. a block of items moved between sections);
 * - after an empty `* `: first line fills it, the rest → sub-points at the same level;
 * - at the end of a `- ` / `+ ` item or a `* ` sub-point: every line → a sub-point under it.
 * ponytail: nested lists are flattened to one level; keep relative indents if that starts to matter.
 */
export function formatDumpPaste(before: string, after: string, pasted: string): string | null {
  const lines = pasted.split(/\r\n?|\n/).map((l) => l.trimEnd()).filter((l) => l.trim())
  if (lines.length < 2 || after.trim()) return null
  const point = (l: string) => l.replace(LIST_MARKER, '').trim()
  const indent = before.length - before.trimStart().length
  const pad = before.slice(0, indent)
  const subs = (rest: string[], at: string) => rest.map((l) => `\n${at}* ${point(l)}`).join('')
  if (!before.trim()) return /^([-+] |#)/.test(lines[0].trimStart()) ? null : `- ${point(lines[0])}${subs(lines.slice(1), `${pad}  `)}`
  if (before.trim() === '*') return `${before.endsWith(' ') ? '' : ' '}${point(lines[0])}${subs(lines.slice(1), pad)}`
  if (/^[-+] /.test(before.slice(indent))) return subs(lines, `${pad}  `)
  if (before.startsWith('* ', indent)) return subs(lines, pad)
  return null
}

// Index of the last line folded under item head i (line(n) = text of line n, null past the end); null = not foldable.
export function dumpFoldEnd(line: (n: number) => string | null, i: number): number | null {
  const head = line(i)
  if (head === null || !(isOpen(head) || isDone(head))) return null
  let end = i
  for (let t = line(end + 1); t !== null && isContinuation(t); t = line(end + 1)) end++
  return end === i ? null : end
}
