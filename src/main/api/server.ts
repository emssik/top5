import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'
import { getApiConfig } from '../store'
import { registerProjectRoutes } from './routes/projects'
import { registerQuickTaskRoutes } from './routes/quick-tasks'
import { registerRepeatingTaskRoutes } from './routes/repeating-tasks'
import { registerMetaRoutes } from './routes/meta'

let server: FastifyInstance | null = null

function createServer(): FastifyInstance {
  const fastify = Fastify({ logger: false })

  // CORS — localhost-only server, allow all origins
  fastify.register(cors, { origin: '*' })

  // Auth hook — exempt /api/v1/health
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url === '/api/v1/health') return
    const apiConfig = getApiConfig()
    const auth = request.headers.authorization
    if (!auth || auth !== `Bearer ${apiConfig.apiKey}`) {
      reply.status(401).send({ ok: false, error: 'Unauthorized' })
    }
  })

  // Register routes
  registerMetaRoutes(fastify)
  registerProjectRoutes(fastify)
  registerQuickTaskRoutes(fastify)
  registerRepeatingTaskRoutes(fastify)

  return fastify
}

export async function startApiServer(): Promise<void> {
  const apiConfig = getApiConfig()
  if (!apiConfig.enabled) return

  const port = Number(process.env.TOP5_API_PORT) || apiConfig.port || 15055
  server = createServer()

  try {
    await server.listen({ port, host: '127.0.0.1' })
    console.log(`[API] Server listening on http://127.0.0.1:${port}`)
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`[API] Port ${port} already in use — API server not started`)
      server = null
    } else {
      console.error('[API] Failed to start server:', err.message)
      server = null
    }
  }
}

export async function stopApiServer(): Promise<void> {
  if (server) {
    await server.close()
    server = null
  }
}

export async function restartApiServer(): Promise<void> {
  await stopApiServer()
  await startApiServer()
}

export function getServerInstance(): FastifyInstance | null {
  return server
}

// For testing — create server without listening
export function createTestServer(): FastifyInstance {
  return createServer()
}
