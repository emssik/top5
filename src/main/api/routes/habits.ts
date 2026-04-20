import type { FastifyInstance } from 'fastify'
import * as habitService from '../../service/habits'

export function registerHabitRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/v1/habits', async () => {
    return { ok: true, data: habitService.getHabitsSummary() }
  })
}
