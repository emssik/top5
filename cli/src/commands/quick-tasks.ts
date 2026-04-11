import type { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { resolveQuickTask } from '../lib/resolve.js'
import { printResult, formatTable, die, warn } from '../lib/output.js'
import { parseDate, formatDueDate } from '../lib/date.js'

interface QuickTask {
  id: string
  title: string
  completed: boolean
  taskNumber?: number
  inProgress?: boolean
  dueDate?: string | null
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
      const client = createClient(globalOpts)

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
              { header: 'DUE', value: (t) => formatDueDate(t.dueDate) },
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
    .option('-d, --due <date>', 'Due date (YYYY-MM-DD, today, tomorrow, +Nd, mon-sun)')
    .action(async (title: string, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        let dueDate: string | undefined
        if (opts.due) {
          const parsed = parseDate(opts.due)
          if (parsed === null) die('Cannot clear due date on a new task. Just omit --due.')
          dueDate = parsed
        }

        const newTask = {
          id: crypto.randomUUID(),
          title,
          completed: false,
          createdAt: new Date().toISOString(),
          completedAt: null,
          order: 0,
          ...(dueDate ? { dueDate } : {}),
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
          } catch (e: unknown) {
            warn(`Note creation failed: ${(e as Error).message}`)
          }
        }

        printResult(savedTask ?? newTask, {
          json: globalOpts.json,
          formatFn: () => {
            let msg = `Created: ${code}${title}`
            if (dueDate) msg += ` (due: ${formatDueDate(dueDate)})`
            if (notePath) msg += `\nNote: ${notePath}`
            return msg
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 qt rm <ref>
  qt.command('rm')
    .description('Delete a quick task')
    .argument('<ref>', 'Quick task code (e.g. QT-5) or ID')
    .action(async (ref: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const task = await resolveQuickTask(client, ref) as QuickTask

        await client.delete(`/api/v1/quick-tasks/${task.id}`)

        printResult(task, {
          json: globalOpts.json,
          formatFn: () => {
            const code = qtCode(task)
            return `Deleted: ${code !== '-' ? code + ' ' : ''}${task.title}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 qt due <ref> [date]
  qt.command('due')
    .description('Set or clear due date for a quick task')
    .argument('<ref>', 'Quick task code (e.g. QT-5) or ID')
    .argument('[date]', 'Due date (YYYY-MM-DD, today, tomorrow, +Nd, mon-sun, or "clear")')
    .action(async (ref: string, dateInput: string | undefined, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const task = await resolveQuickTask(client, ref) as QuickTask

        // No date arg — show current due date
        if (!dateInput) {
          printResult(task, {
            json: globalOpts.json,
            formatFn: () => {
              const code = qtCode(task)
              const due = task.dueDate ? formatDueDate(task.dueDate) : '(none)'
              return `${code !== '-' ? code + ' ' : ''}${task.title} — due: ${due}`
            },
          })
          return
        }

        const dueDate = parseDate(dateInput)

        await client.put(`/api/v1/quick-tasks/${task.id}/due-date`, { dueDate })

        printResult({ ...task, dueDate }, {
          json: globalOpts.json,
          formatFn: () => {
            const code = qtCode(task)
            const prefix = code !== '-' ? code + ' ' : ''
            if (dueDate === null) return `${prefix}${task.title} — due date cleared`
            return `${prefix}${task.title} — due: ${formatDueDate(dueDate)}`
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
      const client = createClient(globalOpts)

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
      const client = createClient(globalOpts)

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
