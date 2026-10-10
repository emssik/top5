// ⌘R in the dump: `pon śr pt: Tytuł #KOD` → repeating task. Pure, shared.
import type { RepeatScheduleLike } from './schedule'
import { findDumpTags, stripDumpTags } from './dump'

export type RepeatLine = { title: string; schedule: RepeatScheduleLike; projectCode: string | null }

// 0 = Sunday … 6 = Saturday.
const DAYS = new Map([['pon', 1], ['wt', 2], ['śr', 3], ['sr', 3], ['czw', 4], ['pt', 5], ['sob', 6], ['nd', 0]])

function parseSchedule(prefix: string): RepeatScheduleLike | null {
  if (prefix === 'codziennie') return { type: 'daily' }
  if (prefix === 'dni robocze') return { type: 'weekdays', days: [1, 2, 3, 4, 5] }
  if (prefix === 'koniec miesiąca' || prefix === 'koniec miesiaca') return { type: 'monthlyLastDay' }
  const interval = /^co (\d+) dni$/.exec(prefix)
  if (interval) return Number(interval[1]) >= 1 ? { type: 'interval', days: Number(interval[1]) } : null
  const day = /^(\d+) dnia$/.exec(prefix)
  if (day) return Number(day[1]) >= 1 && Number(day[1]) <= 31 ? { type: 'monthlyDay', day: Number(day[1]) } : null
  // filter(Boolean): a leading / trailing comma (`pon, śr,`) leaves an empty token.
  const days = prefix.split(/[\s,]+/).filter(Boolean).map((d) => DAYS.get(d))
  return days.length > 0 && days.every((d) => d !== undefined) ? { type: 'weekdays', days: [...new Set(days)] } : null
}

// `line` = first line of the item, with or without the leading `- `; `codes` = project codes (tags).
export function parseRepeatLine(line: string, codes: string[]): RepeatLine | null {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const prefix = line.slice(0, colon).trim().replace(/^- /, '').trim().toLowerCase().replace(/\s+/g, ' ')
  const rest = line.slice(colon + 1)
  const title = stripDumpTags(rest, codes)
  const schedule = parseSchedule(prefix)
  if (!schedule || !title) return null
  return { title, schedule, projectCode: findDumpTags(`- ${rest}`, codes)[0]?.code ?? null }
}
