import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { join, basename, resolve } from 'path'
import { shell } from 'electron'
import { dateKey } from '../../shared/schedule'
import { getData, loadCheckIns } from '../store'
import { loadWinHistory } from './wins'
import type { FocusCheckIn } from '../../shared/types'
import { formatTaskId, formatQuickTaskId } from '../../shared/taskId'

// --- Helpers ---

function checkInMinutes(checkIn: FocusCheckIn): number {
  if (typeof checkIn.minutes === 'number' && checkIn.minutes >= 0) return checkIn.minutes
  if (checkIn.response === 'yes') return 15
  if (checkIn.response === 'a_little') return 7
  return 0
}

function formatMinutes(min: number): string {
  if (min <= 0) return '0min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${h}h`
}

function getJournalDir(): string | null {
  const config = getData().config
  if (!config.obsidianStoragePath) return null
  const vaultPath = resolve(config.obsidianStoragePath.replace(/\/+$/, ''))
  return join(vaultPath, 'top5.journal')
}

function getVaultName(): string {
  const config = getData().config
  if (config.obsidianVaultName) return config.obsidianVaultName
  if (config.obsidianStoragePath) return basename(resolve(config.obsidianStoragePath.replace(/\/+$/, '')))
  return 'vault'
}

const PL_WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota']
const PL_WEEKDAYS_SHORT = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob']
const PL_MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
const PL_MONTHS_STANDALONE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień']

function formatDatePl(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const weekday = PL_WEEKDAYS[d.getDay()]
  const day = d.getDate()
  const month = PL_MONTHS[d.getMonth()]
  const year = d.getFullYear()
  return `${weekday}, ${day} ${month} ${year}`
}

function formatMonthPl(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${PL_MONTHS_STANDALONE[m - 1]} ${y}`
}

// --- Day Stats ---

interface CompletedTask {
  badge: string
  title: string
  projectName?: string
}

interface ProjectFocus {
  projectName: string
  projectCode?: string
  minutes: number
}

interface DayStats {
  tasksCompleted: number
  focusMinutes: number
  completedTasks: CompletedTask[]
  focusPerProject: ProjectFocus[]
}

function gatherDayStats(dateStr: string): DayStats {
  const data = getData()
  const checkIns = loadCheckIns()

  const completed: CompletedTask[] = []

  for (const project of data.projects) {
    for (const task of project.tasks) {
      if (task.completed && task.completedAt?.startsWith(dateStr)) {
        completed.push({
          badge: formatTaskId(task.taskNumber, project.code),
          title: task.title,
          projectName: project.name
        })
      }
    }
  }

  for (const qt of data.quickTasks) {
    if (qt.completed && qt.completedAt?.startsWith(dateStr)) {
      completed.push({
        badge: formatQuickTaskId(qt.taskNumber),
        title: qt.title
      })
    }
  }

  // Focus time per project
  const projectMinutes = new Map<string, number>()
  const projectNames = new Map<string, string>()
  const projectCodes = new Map<string, string | undefined>()

  for (const project of data.projects) {
    projectNames.set(project.id, project.name)
    projectCodes.set(project.id, project.code)
  }

  for (const ci of checkIns) {
    if (!ci.timestamp.startsWith(dateStr)) continue
    const mins = checkInMinutes(ci)
    if (mins <= 0) continue
    projectMinutes.set(ci.projectId, (projectMinutes.get(ci.projectId) ?? 0) + mins)
  }

  const focusPerProject: ProjectFocus[] = [...projectMinutes.entries()]
    .map(([pid, mins]) => ({
      projectName: projectNames.get(pid) ?? 'Unknown',
      projectCode: projectCodes.get(pid),
      minutes: mins
    }))
    .sort((a, b) => b.minutes - a.minutes)

  const totalFocusMinutes = focusPerProject.reduce((sum, p) => sum + p.minutes, 0)

  return { tasksCompleted: completed.length, focusMinutes: totalFocusMinutes, completedTasks: completed, focusPerProject }
}

// --- Parse existing note ---

interface ParsedNote {
  reflection: string
  notes: string
}

function parseExistingNote(markdown: string): ParsedNote {
  // Match both Polish and English section names for backward compat
  const reflectionMatch = markdown.match(/## (?:Refleksja|Reflection)\n([\s\S]*?)(?=\n---\n|\n## (?:Zrobione|Stats|Notatki|Notes))/)
  const notesMatch = markdown.match(/## (?:Notatki|Notes)\n([\s\S]*?)$/)

  return {
    reflection: reflectionMatch ? reflectionMatch[1].trimEnd() : '',
    notes: notesMatch ? notesMatch[1].trimEnd() : ''
  }
}

// --- Date helpers ---

function prevDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return dateKey(d)
}

function nextDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return dateKey(d)
}

// --- Generate daily markdown ---

function generateDailyMarkdown(dateStr: string, stats: DayStats, existing?: ParsedNote): string {
  const prev = prevDate(dateStr)
  const next = nextDate(dateStr)

  const lines: string[] = [
    '---',
    `date: ${dateStr}`,
    'type: daily',
    `tasks_completed: ${stats.tasksCompleted}`,
    `focus_minutes: ${stats.focusMinutes}`,
    '---',
    '',
    `[← ${prev}](${prev}.md) · [Index](../index.md) · [${next} →](${next}.md)`,
    '',
    `# ${formatDatePl(dateStr)}`,
    ''
  ]

  // Refleksja
  lines.push('## Refleksja')
  lines.push('')
  if (existing?.reflection) {
    lines.push(existing.reflection)
  } else {
    lines.push('**Z czego jestem dziś najbardziej zadowolony/a?**')
    lines.push('')
    lines.push('> ')
    lines.push('')
    lines.push('**Za co jestem wdzięczny/a?**')
    lines.push('')
    lines.push('> ')
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  // Zrobione
  if (stats.completedTasks.length > 0) {
    lines.push('## Zrobione')
    lines.push('')
    for (const task of stats.completedTasks) {
      const prefix = task.badge ? `${task.badge} — ` : ''
      lines.push(`- [x] ${prefix}${task.title}`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  // Notatki
  lines.push('## Notatki')
  lines.push('')
  if (existing?.notes) {
    lines.push(existing.notes)
  }
  lines.push('')

  return lines.join('\n')
}

// --- ISO week helpers ---

function toISOWeekKey(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function weekDates(weekKey: string): string[] {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return []
  const year = Number(match[1])
  const week = Number(match[2])

  const jan4 = new Date(year, 0, 4)
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (week - 1) * 7)

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(dateKey(d))
  }
  return dates
}

function monthDates(monthKey: string): string[] {
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const dates: string[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return dates
}

// --- Range stats (for weekly/monthly) ---

interface RangeStats {
  totalTasks: number
  totalFocusMinutes: number
  dailyBreakdown: { date: string; tasks: number; focusMinutes: number; result: 'win' | 'loss' | null }[]
  focusPerProject: ProjectFocus[]
}

function gatherRangeStats(dates: string[]): RangeStats {
  const data = getData()
  const checkIns = loadCheckIns()
  const winHistory = loadWinHistory()
  const winByDate = new Map<string, 'win' | 'loss'>()
  for (const e of winHistory) winByDate.set(e.date, e.result)

  const projectNames = new Map<string, string>()
  const projectCodes = new Map<string, string | undefined>()
  for (const project of data.projects) {
    projectNames.set(project.id, project.name)
    projectCodes.set(project.id, project.code)
  }

  let totalTasks = 0
  let totalFocusMinutes = 0
  const dailyBreakdown: RangeStats['dailyBreakdown'] = []
  const projectMinutes = new Map<string, number>()

  for (const dateStr of dates) {
    let dayTasks = 0
    let dayFocus = 0

    for (const project of data.projects) {
      for (const task of project.tasks) {
        if (task.completed && task.completedAt?.startsWith(dateStr)) dayTasks++
      }
    }
    for (const qt of data.quickTasks) {
      if (qt.completed && qt.completedAt?.startsWith(dateStr)) dayTasks++
    }

    for (const ci of checkIns) {
      if (!ci.timestamp.startsWith(dateStr)) continue
      const mins = checkInMinutes(ci)
      if (mins <= 0) continue
      dayFocus += mins
      projectMinutes.set(ci.projectId, (projectMinutes.get(ci.projectId) ?? 0) + mins)
    }

    totalTasks += dayTasks
    totalFocusMinutes += dayFocus
    dailyBreakdown.push({ date: dateStr, tasks: dayTasks, focusMinutes: dayFocus, result: winByDate.get(dateStr) ?? null })
  }

  const focusPerProject = [...projectMinutes.entries()]
    .map(([pid, mins]) => ({
      projectName: projectNames.get(pid) ?? 'Unknown',
      projectCode: projectCodes.get(pid),
      minutes: mins
    }))
    .sort((a, b) => b.minutes - a.minutes)

  return { totalTasks, totalFocusMinutes, dailyBreakdown, focusPerProject }
}

// --- Public API ---

export interface JournalResult {
  path: string
  notePath: string
}

export function generateDailyNote(dateStr?: string): JournalResult | null {
  const journalDir = getJournalDir()
  if (!journalDir) return null

  const day = dateStr ?? dateKey(new Date())
  const dailyDir = join(journalDir, 'daily')
  mkdirSync(dailyDir, { recursive: true })

  const filePath = join(dailyDir, `${day}.md`)

  let existing: ParsedNote | undefined
  if (existsSync(filePath)) {
    existing = parseExistingNote(readFileSync(filePath, 'utf-8'))
  }

  const stats = gatherDayStats(day)
  const markdown = generateDailyMarkdown(day, stats, existing)
  writeFileSync(filePath, markdown, 'utf-8')

  generateIndex()
  generateDictionary()

  // Auto-generate weekly/monthly if applicable
  const d = new Date(day + 'T12:00:00')
  if (d.getDay() === 1) {
    const prevMonday = new Date(d)
    prevMonday.setDate(prevMonday.getDate() - 7)
    try { generateWeeklyNote(toISOWeekKey(prevMonday)) } catch { /* non-critical */ }
  }
  if (d.getDate() === 1) {
    const prevMonth = new Date(d)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const mk = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
    try { generateMonthlyNote(mk) } catch { /* non-critical */ }
  }

  return { path: filePath, notePath: `top5.journal/daily/${day}` }
}

export function generateWeeklyNote(weekKey?: string): JournalResult | null {
  const journalDir = getJournalDir()
  if (!journalDir) return null

  const wk = weekKey ?? toISOWeekKey(new Date())
  const dates = weekDates(wk)
  if (dates.length === 0) return null

  const weeklyDir = join(journalDir, 'weekly')
  mkdirSync(weeklyDir, { recursive: true })

  const filePath = join(weeklyDir, `${wk}.md`)
  const stats = gatherRangeStats(dates)

  let existing: ParsedNote | undefined
  if (existsSync(filePath)) {
    existing = parseExistingNote(readFileSync(filePath, 'utf-8'))
  }

  const wins = stats.dailyBreakdown.filter((d) => d.result === 'win').length
  const losses = stats.dailyBreakdown.filter((d) => d.result === 'loss').length

  const lines: string[] = [
    '---',
    `week: ${wk}`,
    'type: weekly',
    `tasks_completed: ${stats.totalTasks}`,
    `focus_minutes: ${stats.totalFocusMinutes}`,
    '---',
    '',
    `[Index](../index.md)`,
    '',
    `# Tydzień ${wk}`,
    '',
    '## Refleksja',
    ''
  ]

  if (existing?.reflection) {
    lines.push(existing.reflection)
  } else {
    lines.push('**Co poszło dobrze w tym tygodniu?**')
    lines.push('')
    lines.push('> ')
    lines.push('')
    lines.push('**Co można poprawić?**')
    lines.push('')
    lines.push('> ')
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Podsumowanie')
  lines.push('')
  lines.push(`- Ukończone: **${stats.totalTasks} zadań**`)
  if (stats.totalFocusMinutes > 0) {
    lines.push(`- Focus: **${formatMinutes(stats.totalFocusMinutes)}**`)
  }
  if (wins > 0 || losses > 0) {
    lines.push(`- Wynik: **${wins}W / ${losses}L**`)
  }
  lines.push('')

  // Daily breakdown table
  lines.push('### Dzień po dniu')
  lines.push('')
  lines.push('| Dzień | Zadania | Focus | Wynik |')
  lines.push('|-------|---------|-------|-------|')
  for (const d of stats.dailyBreakdown) {
    const dow = new Date(d.date + 'T12:00:00').getDay()
    const dayName = PL_WEEKDAYS_SHORT[dow]
    const resultIcon = d.result === 'win' ? '✓' : d.result === 'loss' ? '✗' : '—'
    const focusStr = d.focusMinutes > 0 ? formatMinutes(d.focusMinutes) : '—'
    lines.push(`| [${dayName} ${d.date}](../daily/${d.date}.md) | ${d.tasks} | ${focusStr} | ${resultIcon} |`)
  }
  lines.push('')

  if (stats.focusPerProject.length > 0) {
    lines.push('### Focus wg projektu')
    for (let i = 0; i < stats.focusPerProject.length; i++) {
      const p = stats.focusPerProject[i]
      const name = p.projectCode ?? p.projectName
      lines.push(`${i + 1}. ${name} — ${formatMinutes(p.minutes)}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## Notatki')
  lines.push('')
  if (existing?.notes) {
    lines.push(existing.notes)
  }
  lines.push('')

  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  generateIndex()
  generateDictionary()

  return { path: filePath, notePath: `top5.journal/weekly/${wk}` }
}

export function generateMonthlyNote(monthKey?: string): JournalResult | null {
  const journalDir = getJournalDir()
  if (!journalDir) return null

  const mk = monthKey ?? (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const dates = monthDates(mk)
  if (dates.length === 0) return null

  const monthlyDir = join(journalDir, 'monthly')
  mkdirSync(monthlyDir, { recursive: true })

  const filePath = join(monthlyDir, `${mk}.md`)
  const stats = gatherRangeStats(dates)

  let existing: ParsedNote | undefined
  if (existsSync(filePath)) {
    existing = parseExistingNote(readFileSync(filePath, 'utf-8'))
  }

  const wins = stats.dailyBreakdown.filter((d) => d.result === 'win').length
  const losses = stats.dailyBreakdown.filter((d) => d.result === 'loss').length

  const lines: string[] = [
    '---',
    `month: ${mk}`,
    'type: monthly',
    `tasks_completed: ${stats.totalTasks}`,
    `focus_minutes: ${stats.totalFocusMinutes}`,
    '---',
    '',
    `[Index](../index.md)`,
    '',
    `# ${formatMonthPl(mk)}`,
    '',
    '## Refleksja',
    ''
  ]

  if (existing?.reflection) {
    lines.push(existing.reflection)
  } else {
    lines.push('**Największe osiągnięcie tego miesiąca?**')
    lines.push('')
    lines.push('> ')
    lines.push('')
    lines.push('**Na czym skupić się w przyszłym miesiącu?**')
    lines.push('')
    lines.push('> ')
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Podsumowanie')
  lines.push('')
  lines.push(`- Ukończone: **${stats.totalTasks} zadań**`)
  if (stats.totalFocusMinutes > 0) {
    lines.push(`- Focus: **${formatMinutes(stats.totalFocusMinutes)}**`)
  }
  if (wins > 0 || losses > 0) {
    lines.push(`- Wynik: **${wins}W / ${losses}L**`)
  }
  lines.push('')

  if (stats.focusPerProject.length > 0) {
    lines.push('### Focus wg projektu')
    for (let i = 0; i < stats.focusPerProject.length; i++) {
      const p = stats.focusPerProject[i]
      const name = p.projectCode ?? p.projectName
      lines.push(`${i + 1}. ${name} — ${formatMinutes(p.minutes)}`)
    }
    lines.push('')
  }

  // Weekly breakdown links
  const weekKeys = new Set<string>()
  for (const d of dates) {
    weekKeys.add(toISOWeekKey(new Date(d + 'T12:00:00')))
  }
  if (weekKeys.size > 0) {
    lines.push('### Tygodnie')
    for (const wk of [...weekKeys].sort()) {
      lines.push(`- [${wk}](../weekly/${wk}.md)`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## Notatki')
  lines.push('')
  if (existing?.notes) {
    lines.push(existing.notes)
  }
  lines.push('')

  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  generateIndex()
  generateDictionary()

  return { path: filePath, notePath: `top5.journal/monthly/${mk}` }
}

// --- Index ---

function generateIndex(): void {
  const journalDir = getJournalDir()
  if (!journalDir) return

  mkdirSync(journalDir, { recursive: true })

  const dailyDir = join(journalDir, 'daily')
  const weeklyDir = join(journalDir, 'weekly')
  const monthlyDir = join(journalDir, 'monthly')

  const dailyFiles: string[] = existsSync(dailyDir)
    ? readdirSync(dailyDir).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', '')).sort().reverse()
    : []

  const weeklyFiles: string[] = existsSync(weeklyDir)
    ? readdirSync(weeklyDir).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', '')).sort().reverse()
    : []

  const monthlyFiles: string[] = existsSync(monthlyDir)
    ? readdirSync(monthlyDir).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', '')).sort().reverse()
    : []

  const lines: string[] = [
    '# Top5 Journal',
    ''
  ]

  if (monthlyFiles.length > 0) {
    lines.push('## Miesiące')
    lines.push('')
    for (const mk of monthlyFiles) {
      lines.push(`- [${formatMonthPl(mk)}](monthly/${mk}.md)`)
    }
    lines.push('')
  }

  if (weeklyFiles.length > 0) {
    lines.push('## Tygodnie')
    lines.push('')
    for (const wk of weeklyFiles) {
      lines.push(`- [${wk}](weekly/${wk}.md)`)
    }
    lines.push('')
  }

  if (dailyFiles.length > 0) {
    const byMonth = new Map<string, string[]>()
    for (const d of dailyFiles) {
      const mk = d.slice(0, 7)
      if (!byMonth.has(mk)) byMonth.set(mk, [])
      byMonth.get(mk)!.push(d)
    }

    lines.push('## Dni')
    lines.push('')
    for (const [mk, days] of byMonth) {
      lines.push(`### ${formatMonthPl(mk)}`)
      lines.push('')
      for (const d of days) {
        const dow = new Date(d + 'T12:00:00').getDay()
        lines.push(`- [${PL_WEEKDAYS_SHORT[dow]} ${d}](daily/${d}.md)`)
      }
      lines.push('')
    }
  }

  writeFileSync(join(journalDir, 'index.md'), lines.join('\n'), 'utf-8')
}

// --- Dictionary for Obsidian autocomplete ---

export function generateDictionary(): void {
  const journalDir = getJournalDir()
  if (!journalDir) return

  mkdirSync(journalDir, { recursive: true })

  const data = getData()
  const projects = data.projects
    .filter((p) => !p.archivedAt && !p.suspendedAt && p.code)
    .sort((a, b) => a.order - b.order)

  const lines = projects.map((p) => `[${p.code}: ${p.name}](top5://project/${p.id})`)
  writeFileSync(join(journalDir, '.top5-dictionary.md'), lines.join('\n') + '\n', 'utf-8')
}

// --- Open journal note ---

export function openJournalNote(notePath: string): void {
  const vaultName = getVaultName()
  const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(notePath)}`
  shell.openExternal(uri)
}
