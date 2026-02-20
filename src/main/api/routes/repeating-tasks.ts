import type { FastifyInstance } from 'fastify'
import { notifyAllWindows } from '../../store'
import * as repeatingTaskService from '../../service/repeating-tasks'
import { isServiceError, errorToHttpStatus } from '../utils'

export function registerRepeatingTaskRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/v1/repeating-tasks', async () => {
    return { ok: true, data: repeatingTaskService.getRepeatingTasks() }
  })

  fastify.post('/api/v1/repeating-tasks', async (request, reply) => {
    const result = repeatingTaskService.saveRepeatingTask(request.body)
    if (isServiceError(result)) return reply.status(400).send({ ok: false, error: result.error })
    notifyAllWindows()
    return reply.status(201).send({ ok: true, data: result })
  })

  fastify.put<{ Params: { id: string } }>('/api/v1/repeating-tasks/:id', async (request, reply) => {
    // Strict update — 404 if not found (no upsert)
    const existing = repeatingTaskService.getRepeatingTasks().find((t) => t.id === request.params.id)
    if (!existing) return reply.status(404).send({ ok: false, error: 'not_found' })
    const body = request.body as any
    if (body && typeof body === 'object') body.id = request.params.id
    const result = repeatingTaskService.saveRepeatingTask(body)
    if (isServiceError(result)) return reply.status(errorToHttpStatus(result.error)).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.delete<{ Params: { id: string } }>('/api/v1/repeating-tasks/:id', async (request, reply) => {
    const result = repeatingTaskService.removeRepeatingTask(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.put('/api/v1/repeating-tasks/reorder', async (request, reply) => {
    const result = repeatingTaskService.reorderRepeatingTasks(request.body)
    if (isServiceError(result)) return reply.status(400).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/repeating-tasks/:id/accept', async (request, reply) => {
    const result = repeatingTaskService.acceptRepeatingProposal(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/repeating-tasks/:id/dismiss', async (request, reply) => {
    const result = repeatingTaskService.dismissRepeatingProposal(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: { dismissed: true } }
  })
}
