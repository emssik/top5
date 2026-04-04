import { clipboard } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { randomUUID } from 'crypto'
import { getData, setData, getConfigDir } from '../store'
import type { Project } from '../../shared/types'

function getImagesDir(): string {
  const dir = join(getConfigDir(), 'images')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getImagesDirPath(): string {
  return getImagesDir()
}

export function pasteImageToTask(
  projectId: string,
  taskId: string
): { filename: string } | { error: string } {
  const img = clipboard.readImage()
  if (img.isEmpty()) return { error: 'no_image' }

  const filename = `${randomUUID()}.png`
  const filePath = join(getImagesDir(), filename)
  writeFileSync(filePath, img.toPNG())

  const data = getData()
  const projects = [...data.projects]
  const project = projects.find((p) => p.id === projectId)
  if (!project) return { error: 'not_found' }
  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) return { error: 'not_found' }

  if (!task.images) task.images = []
  task.images.push(filename)
  setData('projects', projects)

  return { filename }
}

export function removeTaskImage(
  projectId: string,
  taskId: string,
  filename: string
): Project[] | { error: string } {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { error: 'validation' }
  }

  const data = getData()
  const projects = [...data.projects]
  const project = projects.find((p) => p.id === projectId)
  if (!project) return { error: 'not_found' }
  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) return { error: 'not_found' }

  task.images = (task.images || []).filter((f) => f !== filename)
  if (task.images.length === 0) task.images = undefined
  setData('projects', projects)

  const filePath = join(getImagesDir(), filename)
  try {
    unlinkSync(filePath)
  } catch {
    /* file may already be gone */
  }

  return projects
}
