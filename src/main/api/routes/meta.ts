import type { FastifyInstance } from 'fastify'

export function registerMetaRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/v1/health', async () => {
    let version = 'unknown'
    try {
      version = require('../../../../package.json').version
    } catch {
      // ignore
    }
    return { ok: true, data: { status: 'ok', version } }
  })
}
