import type { Project, Task } from '../../shared/types'
import {
  getData,
  setData,
  appendOperation,
  taskTimeMinutes,
  isValidProject,
  normalizeProject,
  assignMissingProjectColors,
  getActiveProjectsLimit
} from '../store'

type ServiceError = { error: 'not_found' | 'validation' | 'active_limit' }

export function getProjects(): Project[] {
  return getData().projects
}

export function getProject(id: string): Project | ServiceError {
  const project = getData().projects.find((p) => p.id === id)
  if (!project) return { error: 'not_found' }
  return project
}

export function createProject(input: unknown): Project[] | ServiceError {
  if (!isValidProject(input)) return { error: 'validation' }
  const data = getData()
  const projects = [...data.projects]
  const normalizedProject = normalizeProject(input)

  const activeCount = projects.filter((p) => !p.archivedAt && !p.suspendedAt).length
  const activeLimit = getActiveProjectsLimit(data.config)
  if (!normalizedProject.archivedAt && !normalizedProject.suspendedAt && activeCount >= activeLimit) {
    normalizedProject.suspendedAt = new Date().toISOString()
  }
  normalizedProject.order = activeCount
  projects.push(normalizedProject)

  const nextProjects = assignMissingProjectColors(projects.map(normalizeProject))
  setData('projects', nextProjects)
  appendOperation({ type: 'project_created', projectId: input.id, projectName: input.name })
  return nextProjects
}

export function updateProject(id: string, input: unknown): Project[] | ServiceError {
  if (!isValidProject(input)) return { error: 'validation' }
  const data = getData()
  const projects = [...data.projects]
  const index = projects.findIndex((p) => p.id === id)
  if (index < 0) return { error: 'not_found' }

  const oldProject = projects[index]
  const normalizedProject = normalizeProject(input)
  projects[index] = normalizedProject

  const nextProjects = assignMissingProjectColors(projects.map(normalizeProject))
  setData('projects', nextProjects)

  // Detect task-level changes for operation log
  const oldTaskMap = new Map(oldProject.tasks.map((t) => [t.id, t]))
  const newTaskMap = new Map((input.tasks as Task[]).map((t) => [t.id, t]))

  for (const t of input.tasks as Task[]) {
    const old = oldTaskMap.get(t.id)
    if (!old) {
      appendOperation({ type: 'task_created', projectId: id, projectName: input.name, taskTitle: t.title })
    } else if (t.completed && !old.completed) {
      const mins = taskTimeMinutes(t.id)
      appendOperation({ type: 'task_completed', projectId: id, projectName: input.name, taskTitle: t.title, ...(mins > 0 && { details: `${mins}min` }) })
    } else if (!t.completed && old.completed) {
      appendOperation({ type: 'task_uncompleted', projectId: id, projectName: input.name, taskTitle: t.title })
    }
  }
  for (const t of oldProject.tasks) {
    if (!newTaskMap.has(t.id)) {
      appendOperation({ type: 'task_deleted', projectId: id, projectName: input.name, taskTitle: t.title })
    }
  }

  const hasTaskChanges = (input.tasks as Task[]).length !== oldProject.tasks.length ||
    (input.tasks as Task[]).some((t) => {
      const old = oldTaskMap.get(t.id)
      return !old || t.completed !== old.completed
    })
  if (!hasTaskChanges && (input.name !== oldProject.name || input.description !== oldProject.description)) {
    appendOperation({ type: 'project_updated', projectId: id, projectName: input.name })
  }

  return nextProjects
}

export function deleteProject(id: string): Project[] | ServiceError {
  const data = getData()
  const deleted = data.projects.find((p) => p.id === id)
  if (!deleted) return { error: 'not_found' }
  const projects = data.projects.filter((p) => p.id !== id)
  setData('projects', projects)
  appendOperation({ type: 'project_deleted', projectId: id, projectName: deleted.name })
  return projects
}

export function archiveProject(id: string): Project[] | ServiceError {
  const data = getData()
  const projects = [...data.projects]
  const project = projects.find((p) => p.id === id)
  if (!project) return { error: 'not_found' }
  if (project.timerStartedAt) {
    const elapsed = Date.now() - new Date(project.timerStartedAt).getTime()
    project.totalTimeMs += elapsed
    project.timerStartedAt = null
  }
  project.archivedAt = new Date().toISOString()
  setData('projects', projects)
  appendOperation({ type: 'project_archived', projectId: id, projectName: project.name })
  return projects
}

export function unarchiveProject(id: string): { projects: Project[] } | ServiceError {
  const data = getData()
  const projects = [...data.projects]
  const activeLimit = getActiveProjectsLimit(data.config)
  const activeProjects = projects.filter((p) => !p.archivedAt && !p.suspendedAt)
  if (activeProjects.length >= activeLimit) return { error: 'active_limit' }
  const project = projects.find((p) => p.id === id)
  if (!project) return { error: 'not_found' }
  project.archivedAt = null
  project.suspendedAt = null
  const usedOrders = activeProjects.map((p) => p.order)
  let nextOrder = 0
  while (usedOrders.includes(nextOrder)) nextOrder++
  project.order = nextOrder
  setData('projects', projects)
  appendOperation({ type: 'project_unarchived', projectId: id, projectName: project.name })
  return { projects }
}

export function suspendProject(id: string): Project[] | ServiceError {
  const data = getData()
  const projects = [...data.projects]
  const project = projects.find((p) => p.id === id)
  if (!project) return { error: 'not_found' }
  project.suspendedAt = new Date().toISOString()
  setData('projects', projects)
  appendOperation({ type: 'project_suspended', projectId: id, projectName: project.name })
  return projects
}

export function unsuspendProject(id: string): { projects: Project[] } | ServiceError {
  const data = getData()
  const projects = [...data.projects]
  const activeLimit = getActiveProjectsLimit(data.config)
  const activeProjects = projects.filter((p) => !p.archivedAt && !p.suspendedAt)
  if (activeProjects.length >= activeLimit) return { error: 'active_limit' }
  const project = projects.find((p) => p.id === id)
  if (!project) return { error: 'not_found' }
  project.suspendedAt = null
  const usedOrders = activeProjects.map((p) => p.order)
  let nextOrder = 0
  while (usedOrders.includes(nextOrder)) nextOrder++
  project.order = nextOrder
  setData('projects', projects)
  appendOperation({ type: 'project_unsuspended', projectId: id, projectName: project.name })
  return { projects }
}

export function reorderProjects(orderedIds: unknown): Project[] | ServiceError {
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === 'string')) return { error: 'validation' }
  const data = getData()
  const projects = [...data.projects]
  for (let i = 0; i < orderedIds.length; i++) {
    const project = projects.find((p) => p.id === orderedIds[i])
    if (project) project.order = i
  }
  setData('projects', projects)
  return projects
}

export function reorderPinnedTasks(updates: unknown): Project[] | ServiceError {
  if (!Array.isArray(updates)) return { error: 'validation' }
  const data = getData()
  const projects = [...data.projects]
  for (const update of updates) {
    if (typeof update?.projectId !== 'string' || typeof update?.taskId !== 'string' || typeof update?.order !== 'number') continue
    const project = projects.find((p) => p.id === update.projectId)
    if (!project) continue
    const task = project.tasks.find((t) => t.id === update.taskId)
    if (task) task.toDoNextOrder = update.order
  }
  setData('projects', projects)
  return projects
}

export function toggleTaskInProgress(projectId: string, taskId: string): Project[] | ServiceError {
  const data = getData()
  const projects = [...data.projects]
  const project = projects.find((p) => p.id === projectId)
  if (!project) return { error: 'not_found' }
  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) return { error: 'not_found' }
  if (!task.completed) {
    task.inProgress = !task.inProgress
    setData('projects', projects)
  }
  return projects
}

export function toggleTaskToDoNext(projectId: string, taskId: string): Project[] | ServiceError {
  const data = getData()
  const projects = [...data.projects]
  const project = projects.find((p) => p.id === projectId)
  if (!project) return { error: 'not_found' }
  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) return { error: 'not_found' }
  task.isToDoNext = !task.isToDoNext
  if (task.isToDoNext) {
    const maxOrder = Math.max(0, ...project.tasks.filter((t) => t.isToDoNext && t.id !== taskId).map((t) => t.toDoNextOrder ?? 999))
    task.toDoNextOrder = maxOrder + 1
  }
  setData('projects', projects)
  return projects
}
