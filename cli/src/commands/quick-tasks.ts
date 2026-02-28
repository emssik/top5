import type { Command } from 'commander'
import { ApiClient } from '../lib/api-client.js'
import { resolveConfig } from '../lib/config.js'
import { resolveQuickTask } from '../lib/resolve.js'
import { printResult, formatTable, die } from '../lib/output.js'

interface QuickTask {
  id: string
  title: string
  completed: boolean
  taskNumber?: number
  inProgress?: boolean
  order: number
  createdAt: string
  completedAt: string | null
  noteRef?: string
}

function qtCode(t: QuickTask): string {
  return t.taskNumber != null ? `QT-${t.taskNumber}` : '-'
}

function qtStatus(t: QuickTask): string {
  if (t.completed) return '[done]'
  if (t.inProgress) return 'in-progress'
  return ''
}

export function register(program: Command): void {
  const qt = program
    .command('qt')
    .description('Quick tasks')
    .option('-a, --all', 'Show all quick tasks (including completed)')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

      try {
        let tasks = await client.get<QuickTask[]>('/api/v1/quick-tasks')

        if (!opts.all) {
          tasks = tasks.filter((t) => !t.completed)
        }

        tasks.sort((a, b) => a.order - b.order)

        printResult(tasks, {
          json: globalOpts.json,
          formatFn: () =>
            formatTable(tasks, [
              { header: '#', value: (t) => qtCode(t), align: 'right' },
              { header: 'TITLE', value: (t) => t.title },
              { header: 'STATUS', value: (t) => qtStatus(t) },
            ]),
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 qt add <title>
  qt.command('add')
    .description('Add a quick task')
    .argument('<title>', 'Task title')
    .option('-n, --note', 'Create a note for the task')
    .action(async (title: string, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

      try {
        const newTask = {
          id: crypto.randomUUID(),
          title,
          completed: false,
          createdAt: new Date().toISOString(),
          completedAt: null,
          order: 0,
        }

        const result = await client.post<QuickTask[]>('/api/v1/quick-tasks', newTask)
        const savedTask = result.find((t) => t.id === newTask.id)

        const code = savedTask?.taskNumber != null ? `QT-${savedTask.taskNumber} ` : ''

        let notePath: string | undefined
        if (opts.note && savedTask) {
          try {
            const noteResult = await client.post<{ noteRef: string; filePath: string }>(
              `/api/v1/quick-tasks/${savedTask.id}/note`
            )
            notePath = noteResult.filePath
          } catch { /* note creation is best-effort */ }
        }

        printResult(savedTask ?? newTask, {
          json: globalOpts.json,
          formatFn: () => {
            let msg = `Created: ${code}${title}`
            if (notePath) msg += `\nNote: ${notePath}`
            return msg
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 qt done <ref>
  qt.command('done')
    .description('Mark a quick task as completed')
    .argument('<ref>', 'Quick task code (e.g. QT-5) or ID')
    .action(async (ref: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

      try {
        const task = await resolveQuickTask(client, ref) as QuickTask

        if (task.completed) {
          printResult(task, {
            json: globalOpts.json,
            formatFn: () => `Already completed: ${task.title}`,
          })
          return
        }

        await client.post(`/api/v1/quick-tasks/${task.id}/complete`)

        printResult({ ...task, completed: true }, {
          json: globalOpts.json,
          formatFn: () => `Done: ${qtCode(task)} ${task.title}`,
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 qt undone <ref>
  qt.command('undone')
    .description('Mark a quick task as not completed')
    .argument('<ref>', 'Quick task code (e.g. QT-5) or ID')
    .action(async (ref: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

      try {
        const task = await resolveQuickTask(client, ref) as QuickTask

        if (!task.completed) {
          printResult(task, {
            json: globalOpts.json,
            formatFn: () => `Already active: ${task.title}`,
          })
          return
        }

        await client.post(`/api/v1/quick-tasks/${task.id}/uncomplete`)

        printResult({ ...task, completed: false }, {
          json: globalOpts.json,
          formatFn: () => `Undone: ${qtCode(task)} ${task.title}`,
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })
}
