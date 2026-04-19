import type { FastifyInstance } from 'fastify'
import { getData, notifyAllWindows } from '../../store'
import { stopFocusForCompletedTask } from '../../focus-window'
import * as quickTaskService from '../../service/quick-tasks'
import { isServiceError, errorToHttpStatus } from '../utils'
import { STANDALONE_PROJECT_ID } from '../../../shared/constants'

export function registerQuickTaskRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/v1/quick-tasks', async () => {
    return { ok: true, data: quickTaskService.getQuickTasks() }
  })

  fastify.post('/api/v1/quick-tasks', async (request, reply) => {
    const result = quickTaskService.saveQuickTask(request.body)
    if (isServiceError(result)) return reply.status(400).send({ ok: false, error: result.error })
    notifyAllWindows()
    return reply.status(201).send({ ok: true, data: result })
  })

  fastify.put<{ Params: { id: string } }>('/api/v1/quick-tasks/:id', async (request, reply) => {
    // Strict update — 404 if not found (no upsert)
    const existing = quickTaskService.getQuickTasks().find((t) => t.id === request.params.id)
    if (!existing) return reply.status(404).send({ ok: false, error: 'not_found' })
    const body = request.body as any
    if (body && typeof body === 'object') body.id = request.params.id
    const result = quickTaskService.saveQuickTask(body)
    if (isServiceError(result)) return reply.status(errorToHttpStatus(result.error)).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.delete<{ Params: { id: string } }>('/api/v1/quick-tasks/:id', async (request, reply) => {
    // Stop focus if the deleted quick task is currently focused
    const { config } = getData()
    if (config.focusProjectId === STANDALONE_PROJECT_ID && config.focusTaskId === request.params.id) {
      stopFocusForCompletedTask(request.params.id)
    }

    const result = quickTaskService.removeQuickTask(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/quick-tasks/:id/complete', async (request, reply) => {
    const result = quickTaskService.completeQuickTask(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/quick-tasks/:id/uncomplete', async (request, reply) => {
    const result = quickTaskService.uncompleteQuickTask(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.put<{ Params: { id: string } }>('/api/v1/quick-tasks/:id/due-date', async (request, reply) => {
    const { dueDate } = request.body as { dueDate: string | null }
    const result = quickTaskService.updateQuickTaskDueDate(request.params.id, dueDate ?? null)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/quick-tasks/:id/toggle-in-progress', async (request, reply) => {
    const result = quickTaskService.toggleQuickTaskInProgress(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.put('/api/v1/quick-tasks/reorder', async (request, reply) => {
    const result = quickTaskService.reorderQuickTasks(request.body)
    if (isServiceError(result)) return reply.status(400).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.put('/api/v1/quick-tasks/beyond-limit', async (request, reply) => {
    const body = request.body as { ids?: unknown; beyondLimit?: unknown } | null
    if (!body || typeof body.beyondLimit !== 'boolean') {
      return reply.status(400).send({ ok: false, error: 'validation' })
    }
    const result = quickTaskService.setBeyondLimitQuickTasks(body.ids as string[], body.beyondLimit)
    if (isServiceError(result)) return reply.status(400).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })
}
