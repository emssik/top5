import { join, resolve } from 'path'
import { homedir } from 'os'
import { mkdirSync, writeFileSync } from 'fs'
import { getData } from '../store'
import { getImagesDirPath } from './task-images'

type ServiceError = { error: 'not_found' }

export interface MyccInboxItem {
  taskCode: string
  projectId: string
  taskId: string
  projectCode: string
  projectName: string
  title: string
  noteRef?: string
}

function buildTitle(taskTitle: string, comment?: string, images?: string[]): string {
  let title = comment ? `Ważne uwagi operatora: ${comment}\n\n${taskTitle}` : taskTitle
  if (images && images.length > 0) {
    const imagesDir = getImagesDirPath()
    const paths = images.map((f) => join(imagesDir, f))
    title += '\n\nZałączone obrazki:\n' + paths.map((p) => `- ${p}`).join('\n')
  }
  return title
}

export function sendTaskToMyCC(projectId: string, taskId: string, comment?: string): (MyccInboxItem & { taskTitle: string }) | ServiceError {
  const data = getData()
  const project = data.projects.find((p) => p.id === projectId)
  if (!project) return { error: 'not_found' }
  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) return { error: 'not_found' }

  const taskCode = project.code && task.taskNumber != null
    ? `${project.code}-${task.taskNumber}`
    : taskId

  let fullNotePath: string | undefined
  if (task.noteRef) {
    const storagePath = data.config.obsidianStoragePath
    if (storagePath) {
      const vaultPath = resolve(storagePath.replace(/\/+$/, ''))
      const relPath = task.noteRef.startsWith('top5.storage/')
        ? task.noteRef.replace('top5.storage/', '')
        : task.noteRef
      fullNotePath = join(vaultPath, 'top5.storage', `${relPath}.md`)
    }
  }

  const item: MyccInboxItem = {
    taskCode,
    projectId,
    taskId,
    projectCode: project.code ?? '',
    projectName: project.name,
    title: buildTitle(task.title, comment, task.images),
    ...(fullNotePath ? { noteRef: fullNotePath } : {}),
  }

  const inboxDir = join(homedir(), '.mycc', 'inbox')
  mkdirSync(inboxDir, { recursive: true })
  const fileName = `${Date.now()}-${taskCode}.json`
  writeFileSync(join(inboxDir, fileName), JSON.stringify(item, null, 2) + '\n')

  return { ...item, taskTitle: task.title }
}
