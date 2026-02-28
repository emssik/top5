import type { FastifyInstance } from 'fastify'
import { notifyAllWindows } from '../../store'
import * as taskNotesService from '../../service/task-notes'
import { isServiceError, errorToHttpStatus } from '../utils'

export function registerNoteRoutes(fastify: FastifyInstance): void {
  fastify.post<{ Params: { pid: string; tid: string } }>(
    '/api/v1/projects/:pid/tasks/:tid/note',
    async (request, reply) => {
      const result = taskNotesService.ensureProjectTaskNote(request.params.pid, request.params.tid)
      if (isServiceError(result)) {
        const status = result.error === 'no_obsidian_path' ? 400 : errorToHttpStatus(result.error)
        return reply.status(status).send({ ok: false, error: result.error })
      }
      notifyAllWindows()
      return { ok: true, data: result }
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/api/v1/quick-tasks/:id/note',
    async (request, reply) => {
      const result = taskNotesService.ensureQuickTaskNote(request.params.id)
      if (isServiceError(result)) {
        const status = result.error === 'no_obsidian_path' ? 400 : errorToHttpStatus(result.error)
        return reply.status(status).send({ ok: false, error: result.error })
      }
      notifyAllWindows()
      return { ok: true, data: result }
    }
  )
}
