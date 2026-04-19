import type { FastifyInstance } from 'fastify'
import { getData, notifyAllWindows } from '../../store'
import { getVisibleTasks } from '../../../shared/task-list'
import * as quickTaskService from '../../service/quick-tasks'
import * as projectService from '../../service/projects'

export function registerTodayRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/v1/today', async () => {
    const data = getData()
    const result = getVisibleTasks({
      quickTasks: data.quickTasks,
      projects: data.projects,
      configLimit: data.config.quickTasksLimit ?? 5,
      winsLock: data.winsLock
    })
    return { ok: true, data: result.allVisible }
  })

  // Push a task to / pull it back from the Today "beyond-the-limit" overflow zone.
  // When beyondLimit=true, also freezes all current natural-overflow tasks so
  // nothing slides up to fill the vacated slot — matches UI drag-and-drop semantics.
  fastify.post('/api/v1/today/beyond-limit', async (request, reply) => {
    const body = request.body as {
      quickTaskIds?: unknown
      pinnedTasks?: unknown
      beyondLimit?: unknown
    } | null
    if (!body || typeof body.beyondLimit !== 'boolean') {
      return reply.status(400).send({ ok: false, error: 'validation' })
    }
    const beyondLimit = body.beyondLimit
    const quickTaskIds = Array.isArray(body.quickTaskIds)
      ? body.quickTaskIds.filter((v): v is string => typeof v === 'string')
      : []
    const pinnedTasks = Array.isArray(body.pinnedTasks)
      ? (body.pinnedTasks as Array<{ projectId?: unknown; taskId?: unknown }>).flatMap((p) =>
          p && typeof p.projectId === 'string' && typeof p.taskId === 'string'
            ? [{ projectId: p.projectId, taskId: p.taskId }]
            : []
        )
      : []

    if (quickTaskIds.length === 0 && pinnedTasks.length === 0) {
      return reply.status(400).send({ ok: false, error: 'validation' })
    }

    const allQuickIds = [...quickTaskIds]
    const allPinned = [...pinnedTasks]

    if (beyondLimit) {
      // Freeze current natural overflow so it doesn't fill the vacated slot.
      const data = getData()
      const { overflow } = getVisibleTasks({
        quickTasks: data.quickTasks,
        projects: data.projects,
        configLimit: data.config.quickTasksLimit ?? 5,
        winsLock: data.winsLock
      })
      const quickSeen = new Set(allQuickIds)
      const pinnedSeen = new Set(allPinned.map((p) => `${p.projectId}:${p.taskId}`))
      for (const t of overflow) {
        if (t.beyondLimit) continue
        if (t.kind === 'quick' && !quickSeen.has(t.id)) {
          allQuickIds.push(t.id)
          quickSeen.add(t.id)
        } else if (t.kind === 'pinned' && t.projectId && t.taskId) {
          const key = `${t.projectId}:${t.taskId}`
          if (!pinnedSeen.has(key)) {
            allPinned.push({ projectId: t.projectId, taskId: t.taskId })
            pinnedSeen.add(key)
          }
        }
      }
    }

    if (allQuickIds.length > 0) {
      quickTaskService.setBeyondLimitQuickTasks(allQuickIds, beyondLimit)
    }
    if (allPinned.length > 0) {
      projectService.setBeyondLimitPinnedTasks(
        allPinned.map((p) => ({ ...p, beyondLimit }))
      )
    }
    notifyAllWindows()
    return { ok: true, data: { quickTaskIds: allQuickIds, pinnedTasks: allPinned, beyondLimit } }
  })
}
