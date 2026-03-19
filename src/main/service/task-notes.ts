import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { basename, join, resolve } from 'path'
import { formatTaskId, formatQuickTaskId, computeNotePath } from '../../shared/taskId'
import { getData, setData } from '../store'

type NoteResult = { noteRef: string; filePath: string }
type ServiceError = { error: 'not_found' | 'no_obsidian_path' }

function ensureTaskNote(
  taskTitle: string,
  projectName?: string,
  taskBadge?: string,
  existingNoteRef?: string
): NoteResult | ServiceError {
  const config = getData().config
  const storagePath = config.obsidianStoragePath
  if (!storagePath) return { error: 'no_obsidian_path' }

  let notePath: string
  let folderName: string
  let safeName: string

  if (typeof existingNoteRef === 'string' && existingNoteRef.startsWith('top5.storage/')) {
    notePath = existingNoteRef
    const parts = existingNoteRef.replace('top5.storage/', '').split('/')
    folderName = parts[0]
    safeName = parts.slice(1).join('/')
  } else {
    notePath = computeNotePath(taskBadge, taskTitle, projectName)
    const parts = notePath.replace('top5.storage/', '').split('/')
    folderName = parts[0]
    safeName = parts.slice(1).join('/')
  }

  const vaultPath = resolve(storagePath.replace(/\/+$/, ''))
  const noteDir = join(vaultPath, 'top5.storage', folderName)
  mkdirSync(noteDir, { recursive: true })

  const filePath = join(noteDir, `${safeName}.md`)

  if (!existsSync(filePath)) {
    const content = projectName
      ? `# ${taskTitle}\n\nProject: ${projectName}\n\n---\n\n`
      : `# ${taskTitle}\n\n---\n\n`
    writeFileSync(filePath, content, 'utf-8')
  }

  return { noteRef: notePath, filePath }
}

export function ensureProjectTaskNote(projectId: string, taskId: string): NoteResult | ServiceError {
  const data = getData()
  const project = data.projects.find((p) => p.id === projectId)
  if (!project) return { error: 'not_found' }
  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) return { error: 'not_found' }

  const badge = formatTaskId(task.taskNumber, project.code) || undefined
  const result = ensureTaskNote(task.title, project.name, badge, task.noteRef)
  if ('error' in result) return result

  // Persist noteRef on the task if not already set
  if (task.noteRef !== result.noteRef) {
    const projects = [...data.projects]
    const p = projects.find((pp) => pp.id === projectId)!
    const t = p.tasks.find((tt) => tt.id === taskId)!
    t.noteRef = result.noteRef
    setData('projects', projects)
  }

  return result
}

export function ensureQuickTaskNote(taskId: string): NoteResult | ServiceError {
  const data = getData()
  const task = data.quickTasks.find((t) => t.id === taskId)
  if (!task) return { error: 'not_found' }

  const badge = formatQuickTaskId(task.taskNumber) || undefined
  const result = ensureTaskNote(task.title, undefined, badge, task.noteRef)
  if ('error' in result) return result

  // Persist noteRef on the task if not already set
  if (task.noteRef !== result.noteRef) {
    const quickTasks = [...data.quickTasks]
    const t = quickTasks.find((tt) => tt.id === taskId)!
    t.noteRef = result.noteRef
    setData('quickTasks', quickTasks)
  }

  return result
}

export function appendDoneEntry(noteRef: string, description: string, focusMinutes: number): { ok: boolean } | ServiceError {
  const config = getData().config
  const storagePath = config.obsidianStoragePath
  if (!storagePath) return { error: 'no_obsidian_path' }

  const vaultPath = resolve(storagePath.replace(/\/+$/, ''))
  const relPath = noteRef.replace('top5.storage/', '')
  const parts = relPath.split('/')
  const folderName = parts[0]
  const safeName = parts.slice(1).join('/')
  const noteDir = join(vaultPath, 'top5.storage', folderName)
  mkdirSync(noteDir, { recursive: true })
  const filePath = join(noteDir, `${safeName}.md`)

  const today = new Date().toISOString().slice(0, 10)
  const timeStr = focusMinutes > 0 ? ` — ${focusMinutes >= 60 ? `${Math.floor(focusMinutes / 60)}h${focusMinutes % 60 > 0 ? ` ${focusMinutes % 60}m` : ''}` : `${focusMinutes}m`}` : ''
  const entry = `- ${today} — ${description}${timeStr}`

  if (!existsSync(filePath)) {
    const content = `## Zrobione\n${entry}\n`
    writeFileSync(filePath, content, 'utf-8')
    return { ok: true }
  }

  const content = readFileSync(filePath, 'utf-8')
  const doneHeader = '## Zrobione'
  const idx = content.indexOf(doneHeader)
  if (idx !== -1) {
    const insertPos = idx + doneHeader.length
    const updated = content.slice(0, insertPos) + `\n${entry}` + content.slice(insertPos)
    writeFileSync(filePath, updated, 'utf-8')
  } else {
    const updated = content.trimEnd() + `\n\n${doneHeader}\n${entry}\n`
    writeFileSync(filePath, updated, 'utf-8')
  }

  return { ok: true }
}

/** Vault name derived from obsidianStoragePath config */
export function getVaultName(): string | null {
  const config = getData().config
  if (!config.obsidianStoragePath) return null
  return config.obsidianVaultName || basename(resolve(config.obsidianStoragePath.replace(/\/+$/, '')))
}
