import type { FastifyInstance } from 'fastify'
import { notifyAllWindows } from '../../store'
import * as dumpService from '../../service/dump'
import { isServiceError, errorToHttpStatus } from '../utils'

// Headroom over MAX_DUMP_BYTES for JSON escaping; the real limit is checked in the service.
const BODY_LIMIT = 4 * dumpService.MAX_DUMP_BYTES

export function registerDumpRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/v1/dump', async () => {
    return { ok: true, data: dumpService.getDump() }
  })

  fastify.put<{ Body: { text?: unknown; baseMtime?: unknown } }>(
    '/api/v1/dump',
    { bodyLimit: BODY_LIMIT },
    async (request, reply) => {
      const body = request.body ?? {}
      const result = dumpService.saveDump(body.text, body.baseMtime ?? null)
      if (isServiceError(result)) return reply.status(errorToHttpStatus(result.error)).send({ ok: false, error: result.error })
      notifyAllWindows()
      return { ok: true, data: result }
    }
  )

  fastify.post<{ Body: { line?: unknown } }>('/api/v1/dump/append', async (request, reply) => {
    const result = dumpService.appendDumpLine(request.body?.line)
    if (isServiceError(result)) return reply.status(errorToHttpStatus(result.error)).send({ ok: false, error: result.error })
    notifyAllWindows()
    return { ok: true, data: result }
  })
}
