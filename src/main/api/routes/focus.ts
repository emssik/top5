import type { FastifyInstance } from 'fastify'
import { getAppData, setAppDataKey, notifyAllWindows } from '../../store'
import { enterFocusMode, exitFocusMode, getFocusStatus, heartbeatFocus } from '../../focus-window'
import * as projectService from '../../service/projects'
import * as quickTaskService from '../../service/quick-tasks'
import { isServiceError } from '../utils'
import { STANDALONE_PROJECT_ID } from '../../../shared/constants'

export function registerFocusRoutes(fastify: FastifyInstance): void {
  // GET /api/v1/focus — current focus status
  fastify.get('/api/v1/focus', async () => {
    return { ok: true, data: getFocusStatus() }
  })

  // POST /api/v1/focus — start focus on a task
  fastify.post('/api/v1/focus', async (request, reply) => {
    const body = request.body as { projectId?: string; taskId?: string } | null
    if (!body?.projectId || !body?.taskId) {
      return reply.status(400).send({ ok: false, error: 'projectId and taskId are required' })
    }

    const { projectId, taskId } = body

    // Validate the task exists
    if (projectId === STANDALONE_PROJECT_ID) {
      const qt = quickTaskService.getQuickTask(taskId)
      if (isServiceError(qt)) {
        return reply.status(404).send({ ok: false, error: 'Quick task not found' })
      }
    } else {
      const project = projectService.getProject(projectId)
      if (isServiceError(project)) {
        return reply.status(404).send({ ok: false, error: 'Project not found' })
      }
      const task = project.tasks.find((t) => t.id === taskId)
      if (!task) {
        return reply.status(404).send({ ok: false, error: 'Task not found in project' })
      }
    }

    // Set focus config (needed for resolveFocusTask inside enterFocusMode)
    const { config } = getAppData()
    setAppDataKey('config', { ...config, focusProjectId: projectId, focusTaskId: taskId })

    const err = enterFocusMode()
    if (err) {
      // Roll back to previous config
      setAppDataKey('config', config)
      return reply.status(409).send({ ok: false, error: err.error })
    }
    notifyAllWindows()

    return { ok: true, data: getFocusStatus() }
  })

  // POST /api/v1/focus/heartbeat — confirm still working, reset check-in timer
  fastify.post('/api/v1/focus/heartbeat', async (_request, reply) => {
    const result = heartbeatFocus()
    if ('error' in result) {
      return reply.status(409).send({ ok: false, error: result.error })
    }
    return { ok: true, data: result }
  })

  // DELETE /api/v1/focus — stop focus
  fastify.delete('/api/v1/focus', async (_request, reply) => {
    const err = exitFocusMode()
    if (err) {
      return reply.status(409).send({ ok: false, error: err.error })
    }
    notifyAllWindows()
    return { ok: true, data: { stopped: true } }
  })
}
