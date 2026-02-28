import { ApiClient } from './api-client.js'

interface ProjectSummary {
  id: string
  code?: string
  name: string
  tasks: TaskSummary[]
}

interface TaskSummary {
  id: string
  taskNumber?: number
  title: string
  completed: boolean
}

const TASK_CODE_RE = /^([A-Za-z]+)-(\d+)$/

/**
 * Parse a task code like "PRJ-3" into { projectCode, taskNumber }.
 * Returns null if the string doesn't match the pattern.
 */
export function parseTaskCode(code: string): { projectCode: string; taskNumber: number } | null {
  const m = TASK_CODE_RE.exec(code)
  if (!m) return null
  return { projectCode: m[1].toUpperCase(), taskNumber: parseInt(m[2], 10) }
}

/**
 * Resolve a project by code or ID.
 */
export async function resolveProject(
  client: ApiClient,
  codeOrId: string
): Promise<ProjectSummary> {
  const projects = await client.get<ProjectSummary[]>('/api/v1/projects')
  const upper = codeOrId.toUpperCase()
  const found =
    projects.find((p) => p.code?.toUpperCase() === upper) ??
    projects.find((p) => p.id === codeOrId)
  if (!found) throw new Error(`Project not found: ${codeOrId}`)
  return found
}

/**
 * Resolve a project task by task code (e.g. "PRJ-3") or raw task ID.
 * Returns { project, task }.
 */
export async function resolveProjectTask(
  client: ApiClient,
  taskRef: string
): Promise<{ project: ProjectSummary; task: TaskSummary }> {
  const parsed = parseTaskCode(taskRef)

  if (parsed) {
    const project = await resolveProject(client, parsed.projectCode)
    const task = project.tasks.find((t) => t.taskNumber === parsed.taskNumber)
    if (!task) throw new Error(`Task ${taskRef} not found in project ${project.code ?? project.name}`)
    return { project, task }
  }

  // Fallback: try as raw task ID across all projects
  const projects = await client.get<ProjectSummary[]>('/api/v1/projects')
  for (const project of projects) {
    const task = project.tasks.find((t) => t.id === taskRef)
    if (task) return { project, task }
  }

  throw new Error(`Task not found: ${taskRef}`)
}

/**
 * Resolve a quick task by code (e.g. "QT-5") or raw ID.
 */
export async function resolveQuickTask(
  client: ApiClient,
  ref: string
): Promise<TaskSummary> {
  const parsed = parseTaskCode(ref)
  const quickTasks = await client.get<TaskSummary[]>('/api/v1/quick-tasks')

  if (parsed && parsed.projectCode === 'QT') {
    const found = quickTasks.find((t) => t.taskNumber === parsed.taskNumber)
    if (!found) throw new Error(`Quick task QT-${parsed.taskNumber} not found`)
    return found
  }

  // Try as raw ID
  const found = quickTasks.find((t) => t.id === ref)
  if (!found) throw new Error(`Quick task not found: ${ref}`)
  return found
}
