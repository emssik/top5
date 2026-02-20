import type { FastifyInstance } from 'fastify'
import { notifyAllWindows } from '../../store'
import * as quickTaskService from '../../service/quick-tasks'
import { isServiceError, errorToHttpStatus } from '../utils'

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
}
