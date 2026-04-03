import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync, writeFileSync } from 'fs'
import { getData } from '../store'

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

export function sendTaskToMyCC(projectId: string, taskId: string): MyccInboxItem | ServiceError {
  const data = getData()
  const project = data.projects.find((p) => p.id === projectId)
  if (!project) return { error: 'not_found' }
  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) return { error: 'not_found' }

  const taskCode = project.code && task.taskNumber != null
    ? `${project.code}-${task.taskNumber}`
    : taskId

  const item: MyccInboxItem = {
    taskCode,
    projectId,
    taskId,
    projectCode: project.code ?? '',
    projectName: project.name,
    title: task.title,
    ...(task.noteRef ? { noteRef: task.noteRef } : {}),
  }

  const inboxDir = join(homedir(), '.mycc', 'inbox')
  mkdirSync(inboxDir, { recursive: true })
  const fileName = `${Date.now()}-${taskCode}.json`
  writeFileSync(join(inboxDir, fileName), JSON.stringify(item, null, 2) + '\n')

  return item
}
