import type { FastifyInstance } from 'fastify'
import { getData } from '../../store'
import { getVisibleTasks } from '../../../shared/task-list'

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
}
