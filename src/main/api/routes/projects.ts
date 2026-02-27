import type { FastifyInstance } from 'fastify'
import { notifyAllWindows } from '../../store'
import * as projectService from '../../service/projects'
import { isServiceError, errorToHttpStatus } from '../utils'



export function registerProjectRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/v1/projects', async () => {
    return { ok: true, data: projectService.getProjects() }
  })

  fastify.get<{ Params: { id: string } }>('/api/v1/projects/:id', async (request, reply) => {
    const result = projectService.getProject(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    return { ok: true, data: result }
  })

  fastify.post('/api/v1/projects', async (request, reply) => {
    const result = projectService.createProject(request.body)
    if (isServiceError(result)) return reply.status(400).send({ ok: false, error: result.error })
    notifyAllWindows()
    return reply.status(201).send({ ok: true, data: result })
  })

  fastify.put<{ Params: { id: string } }>('/api/v1/projects/:id', async (request, reply) => {
    const result = projectService.updateProject(request.params.id, request.body)
    if (isServiceError(result)) return reply.status(errorToHttpStatus(result.error)).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.delete<{ Params: { id: string } }>('/api/v1/projects/:id', async (request, reply) => {
    const result = projectService.deleteProject(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/projects/:id/archive', async (request, reply) => {
    const result = projectService.archiveProject(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/projects/:id/unarchive', async (request, reply) => {
    const result = projectService.unarchiveProject(request.params.id)
    if (isServiceError(result)) return reply.status(errorToHttpStatus(result.error)).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/projects/:id/suspend', async (request, reply) => {
    const result = projectService.suspendProject(request.params.id)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/projects/:id/unsuspend', async (request, reply) => {
    const result = projectService.unsuspendProject(request.params.id)
    if (isServiceError(result)) return reply.status(errorToHttpStatus(result.error)).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.put('/api/v1/projects/reorder', async (request, reply) => {
    const result = projectService.reorderProjects(request.body)
    if (isServiceError(result)) return reply.status(400).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { pid: string; tid: string } }>('/api/v1/projects/:pid/tasks/:tid/toggle-in-progress', async (request, reply) => {
    const result = projectService.toggleTaskInProgress(request.params.pid, request.params.tid)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { pid: string; tid: string } }>('/api/v1/projects/:pid/tasks/:tid/toggle-to-do-next', async (request, reply) => {
    const result = projectService.toggleTaskToDoNext(request.params.pid, request.params.tid)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.put('/api/v1/projects/pinned-tasks/reorder', async (request, reply) => {
    const result = projectService.reorderPinnedTasks(request.body)
    if (isServiceError(result)) return reply.status(400).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.put<{ Params: { pid: string; tid: string } }>('/api/v1/projects/:pid/tasks/:tid/due-date', async (request, reply) => {
    const { dueDate } = request.body as { dueDate: string | null }
    const result = projectService.updateTaskDueDate(request.params.pid, request.params.tid, dueDate ?? null)
    if (isServiceError(result)) return reply.status(404).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.post<{ Params: { pid: string; tid: string } }>('/api/v1/projects/:pid/tasks/:tid/move', async (request, reply) => {
    const { toProjectId } = request.body as { toProjectId: string }
    if (!toProjectId) return reply.status(400).send({ ok: false, error: 'validation' })
    const result = projectService.moveTaskToProject(request.params.pid, toProjectId, request.params.tid)
    if (isServiceError(result)) return reply.status(errorToHttpStatus(result.error)).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })

  fastify.put('/api/v1/projects/pinned-tasks/beyond-limit', async (request, reply) => {
    const result = projectService.setBeyondLimitPinnedTasks(request.body)
    if (isServiceError(result)) return reply.status(400).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })
}
