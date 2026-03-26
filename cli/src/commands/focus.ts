import type { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { resolveProjectTask, resolveQuickTask, parseTaskCode } from '../lib/resolve.js'
import { printResult, die } from '../lib/output.js'

interface FocusStatus {
  active: boolean
  projectId?: string
  taskId?: string
  projectName?: string
  taskTitle?: string
  startedAt?: number
  elapsedMs?: number
}

function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function register(program: Command): void {
  program
    .command('focus')
    .description('Start, stop, or check focus mode')
    .argument('[task-ref]', 'Task code (PRJ-3 / QT-5) or "stop"')
    .action(async (taskRef: string | undefined, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        // No argument — show status
        if (!taskRef) {
          const status = await client.get<FocusStatus>('/api/v1/focus')
          printResult(status, {
            json: globalOpts.json,
            formatFn: () => {
              if (!status.active) return 'No active focus session.'
              const elapsed = status.elapsedMs ? ` (${formatElapsed(status.elapsedMs)})` : ''
              const task = status.taskTitle ?? 'unknown task'
              const project = status.projectName ? `[${status.projectName}] ` : ''
              return `Focus: ${project}${task}${elapsed}`
            },
          })
          return
        }

        // "stop" — exit focus
        if (taskRef.toLowerCase() === 'stop') {
          await client.delete<{ stopped: boolean }>('/api/v1/focus')
          printResult({ stopped: true }, {
            json: globalOpts.json,
            formatFn: () => 'Focus stopped.',
          })
          return
        }

        // "ping" — heartbeat, confirm still working
        if (taskRef.toLowerCase() === 'ping') {
          const result = await client.post<{ saved: boolean; minutes: number }>('/api/v1/focus/heartbeat', {})
          printResult(result, {
            json: globalOpts.json,
            formatFn: () => result.saved ? `Heartbeat OK (${result.minutes}min saved)` : 'Heartbeat OK',
          })
          return
        }

        // Task ref — start focus
        const parsed = parseTaskCode(taskRef)
        let projectId: string
        let taskId: string
        let taskTitle: string

        if (parsed && parsed.projectCode === 'QT') {
          const qt = await resolveQuickTask(client, taskRef)
          projectId = '__standalone__'
          taskId = qt.id
          taskTitle = qt.title
        } else {
          const { project, task } = await resolveProjectTask(client, taskRef)
          projectId = project.id
          taskId = task.id
          taskTitle = task.title
        }

        const status = await client.post<FocusStatus>('/api/v1/focus', { projectId, taskId })

        printResult(status, {
          json: globalOpts.json,
          formatFn: () => `Focus started: ${taskRef.toUpperCase()} ${taskTitle}`,
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })
}
