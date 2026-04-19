import type { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { resolveProject, resolveProjectTask, resolveQuickTask, parseTaskCode } from '../lib/resolve.js'
import { printResult, formatTable, die, warn } from '../lib/output.js'
import { parseDate, formatDueDate } from '../lib/date.js'

interface Task {
  id: string
  title: string
  completed: boolean
  taskNumber?: number
  isToDoNext?: boolean
  inProgress?: boolean
  beyondLimit?: boolean
  dueDate?: string | null
  noteRef?: string
}

interface Project {
  id: string
  name: string
  code?: string
  tasks: Task[]
}

function taskStatus(t: Task): string {
  if (t.completed) return '[done]'
  if (t.inProgress) return 'in-progress'
  if (t.isToDoNext) return 'up-next'
  return ''
}

function taskCode(t: Task, projectCode?: string): string {
  if (t.taskNumber != null && projectCode) {
    return `${projectCode}-${t.taskNumber}`
  }
  return String(t.taskNumber ?? '-')
}

export function register(program: Command): void {
  // top5 tasks <project>
  program
    .command('tasks')
    .description('List tasks in a project')
    .argument('<project>', 'Project code or ID')
    .option('-a, --all', 'Show all tasks (including completed)')
    .action(async (projectRef: string, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const project = await resolveProject(client, projectRef) as Project
        let tasks = project.tasks

        if (!opts.all) {
          tasks = tasks.filter((t) => !t.completed)
        }

        printResult(tasks, {
          json: globalOpts.json,
          formatFn: () => {
            const header = `${project.code ?? project.id} - ${project.name}`
            const table = formatTable(tasks, [
              { header: '#', value: (t) => taskCode(t, project.code), align: 'right' },
              { header: 'TITLE', value: (t) => t.title },
              { header: 'DUE', value: (t) => formatDueDate(t.dueDate) },
              { header: 'STATUS', value: (t) => taskStatus(t) },
            ])
            return `${header}\n${table}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 show <task-code>
  program
    .command('show')
    .description('Show details of a single task')
    .argument('<task-code>', 'Task code (e.g. PRJ-3) or task ID')
    .action(async (taskRef: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const { project, task } = await resolveProjectTask(client, taskRef) as {
          project: Project
          task: Task
        }

        const data = { ...task, projectId: project.id, projectCode: project.code }

        printResult(data, {
          json: globalOpts.json,
          formatFn: () => {
            const code = taskCode(task, project.code)
            const lines: string[] = []
            lines.push(`${code !== '-' ? code + ' ' : ''}${task.title}`)
            lines.push(`Project:  ${project.name}`)
            lines.push(`Status:   ${taskStatus(task) || 'backlog'}`)
            lines.push(`Due:      ${task.dueDate ? formatDueDate(task.dueDate) : '(none)'}`)
            return lines.join('\n')
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 add <project> <title>
  program
    .command('add')
    .description('Add a task to a project')
    .argument('<project>', 'Project code or ID')
    .argument('<title>', 'Task title')
    .option('-n, --note', 'Create a note for the task')
    .option('-d, --due <date>', 'Due date (YYYY-MM-DD, today, tomorrow, +Nd, mon-sun)')
    .option('-p, --pin', 'Pin task to today (mark as up-next)')
    .action(async (projectRef: string, title: string, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        let dueDate: string | undefined
        if (opts.due) {
          const parsed = parseDate(opts.due)
          if (parsed === null) die('Cannot clear due date on a new task. Just omit --due.')
          dueDate = parsed
        }

        const project = await resolveProject(client, projectRef) as Project

        const newTask = {
          id: crypto.randomUUID(),
          title,
          completed: false,
          createdAt: new Date().toISOString(),
          ...(dueDate ? { dueDate } : {}),
        }

        // Update project with new task appended
        const updatedProject = {
          ...project,
          tasks: [...project.tasks, newTask],
        }

        const result = await client.put<Project[]>(`/api/v1/projects/${project.id}`, updatedProject)

        // Find the created task in result to show task number
        const savedProject = result.find((p) => p.id === project.id)
        const savedTask = savedProject?.tasks.find((t) => t.id === newTask.id)

        const code = savedTask?.taskNumber != null && project.code
          ? `${project.code}-${savedTask.taskNumber}`
          : ''

        let pinned = false
        if (opts.pin && savedTask) {
          try {
            await client.post(`/api/v1/projects/${project.id}/tasks/${savedTask.id}/toggle-to-do-next`)
            pinned = true
          } catch (e: unknown) {
            warn(`Pin failed: ${(e as Error).message}`)
          }
        }

        let notePath: string | undefined
        if (opts.note && savedTask) {
          try {
            const noteResult = await client.post<{ noteRef: string; filePath: string }>(
              `/api/v1/projects/${project.id}/tasks/${savedTask.id}/note`
            )
            notePath = noteResult.filePath
          } catch (e: unknown) {
            warn(`Note creation failed: ${(e as Error).message}`)
          }
        }

        const resultData = {
          ...(savedTask ?? newTask),
          ...(notePath ? { notePath } : {}),
          ...(pinned ? { pinned } : {}),
        }

        printResult(resultData, {
          json: globalOpts.json,
          formatFn: () => {
            let msg = `Created: ${code ? code + ' ' : ''}${title}`
            if (dueDate) msg += ` (due: ${formatDueDate(dueDate)})`
            if (pinned) msg += ` [pinned]`
            if (notePath) msg += `\nNote: ${notePath}`
            return msg
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 due <task-code> [date]
  program
    .command('due')
    .description('Set or clear due date for a project task')
    .argument('<task-code>', 'Task code (e.g. PRJ-3) or task ID')
    .argument('[date]', 'Due date (YYYY-MM-DD, today, tomorrow, +Nd, mon-sun, or "clear")')
    .action(async (taskRef: string, dateInput: string | undefined, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const { project, task } = await resolveProjectTask(client, taskRef) as {
          project: Project
          task: Task
        }

        // No date arg — show current due date
        if (!dateInput) {
          printResult(task, {
            json: globalOpts.json,
            formatFn: () => {
              const code = taskCode(task, project.code)
              const due = task.dueDate ? formatDueDate(task.dueDate) : '(none)'
              return `${code !== '-' ? code + ' ' : ''}${task.title} — due: ${due}`
            },
          })
          return
        }

        const dueDate = parseDate(dateInput)

        await client.put(`/api/v1/projects/${project.id}/tasks/${task.id}/due-date`, { dueDate })

        printResult({ ...task, dueDate }, {
          json: globalOpts.json,
          formatFn: () => {
            const code = taskCode(task, project.code)
            const prefix = code !== '-' ? code + ' ' : ''
            if (dueDate === null) return `${prefix}${task.title} — due date cleared`
            return `${prefix}${task.title} — due: ${formatDueDate(dueDate)}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 pin <task-code>
  program
    .command('pin')
    .description('Toggle pin-to-today on a project task')
    .argument('<task-code>', 'Task code (e.g. PRJ-3) or task ID')
    .action(async (taskRef: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const { project, task } = await resolveProjectTask(client, taskRef) as {
          project: Project
          task: Task
        }

        const result = await client.post<Project[]>(
          `/api/v1/projects/${project.id}/tasks/${task.id}/toggle-to-do-next`
        )

        const updatedProject = result.find((p) => p.id === project.id)
        const updatedTask = updatedProject?.tasks.find((t) => t.id === task.id)
        const pinned = updatedTask?.isToDoNext ?? !task.isToDoNext

        printResult(updatedTask ?? task, {
          json: globalOpts.json,
          formatFn: () => {
            const code = taskCode(task, project.code)
            const prefix = code !== '-' ? code + ' ' : ''
            return pinned
              ? `Pinned: ${prefix}${task.title}`
              : `Unpinned: ${prefix}${task.title}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 done <task-code>
  program
    .command('done')
    .description('Mark a project task as completed')
    .argument('<task-code>', 'Task code (e.g. PRJ-3) or task ID')
    .action(async (taskRef: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const { project, task } = await resolveProjectTask(client, taskRef) as {
          project: Project
          task: Task
        }

        if (task.completed) {
          printResult(task, {
            json: globalOpts.json,
            formatFn: () => `Already completed: ${task.title}`,
          })
          return
        }

        // Update the project with the task marked completed
        const updatedTasks = project.tasks.map((t) =>
          t.id === task.id
            ? { ...t, completed: true, completedAt: new Date().toISOString(), inProgress: false }
            : t
        )
        const updatedProject = { ...project, tasks: updatedTasks }

        await client.put(`/api/v1/projects/${project.id}`, updatedProject)

        printResult({ ...task, completed: true }, {
          json: globalOpts.json,
          formatFn: () => {
            const code = taskCode(task, project.code)
            return `Done: ${code !== '-' ? code + ' ' : ''}${task.title}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 undone <task-code>
  program
    .command('undone')
    .description('Mark a project task as not completed')
    .argument('<task-code>', 'Task code (e.g. PRJ-3) or task ID')
    .action(async (taskRef: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const { project, task } = await resolveProjectTask(client, taskRef) as {
          project: Project
          task: Task
        }

        if (!task.completed) {
          printResult(task, {
            json: globalOpts.json,
            formatFn: () => `Already active: ${task.title}`,
          })
          return
        }

        const updatedTasks = project.tasks.map((t) =>
          t.id === task.id
            ? { ...t, completed: false, completedAt: null }
            : t
        )
        const updatedProject = { ...project, tasks: updatedTasks }

        await client.put(`/api/v1/projects/${project.id}`, updatedProject)

        printResult({ ...task, completed: false }, {
          json: globalOpts.json,
          formatFn: () => {
            const code = taskCode(task, project.code)
            return `Undone: ${code !== '-' ? code + ' ' : ''}${task.title}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 rm <task-code>
  program
    .command('rm')
    .description('Delete a project task')
    .argument('<task-code>', 'Task code (e.g. PRJ-3) or task ID')
    .action(async (taskRef: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const { project, task } = await resolveProjectTask(client, taskRef) as {
          project: Project
          task: Task
        }

        await client.delete(`/api/v1/projects/${project.id}/tasks/${task.id}`)

        printResult(task, {
          json: globalOpts.json,
          formatFn: () => {
            const code = taskCode(task, project.code)
            return `Deleted: ${code !== '-' ? code + ' ' : ''}${task.title}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 send <task-code>
  program
    .command('send')
    .description('Send a project task to MyCC inbox')
    .argument('<task-code>', 'Task code (e.g. PRJ-3) or task ID')
    .option('-c, --comment <text>', 'Comment to include as prompt context')
    .action(async (taskRef: string, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const { project, task } = await resolveProjectTask(client, taskRef) as {
          project: Project
          task: Task
        }

        const body = opts.comment ? { comment: opts.comment } : undefined
        const result = await client.post<{ taskCode: string; projectCode: string; projectName: string; title: string; noteRef?: string }>(
          `/api/v1/projects/${project.id}/tasks/${task.id}/send-to-mycc`,
          body
        )

        printResult(result, {
          json: globalOpts.json,
          formatFn: () => {
            const code = taskCode(task, project.code)
            return `Sent to MyCC: ${code !== '-' ? code + ' ' : ''}${task.title}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 beyond <task-code>
  program
    .command('beyond')
    .description('Toggle beyond-the-limit flag on a task (moves it to overflow on Today)')
    .argument('<task-code>', 'Task code (e.g. PRJ-3, QT-5) or task ID')
    .action(async (taskRef: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const parsed = parseTaskCode(taskRef)
        const isQuickRef = parsed?.projectCode === 'QT'

        const resolveQuick = async (): Promise<{ task: Task; code: string }> => {
          const task = await resolveQuickTask(client, taskRef) as Task
          return { task, code: task.taskNumber != null ? `QT-${task.taskNumber}` : '-' }
        }

        let kind: 'quick' | 'pinned'
        let task: Task
        let code: string
        let projectId: string | undefined

        if (isQuickRef) {
          const q = await resolveQuick()
          kind = 'quick'; task = q.task; code = q.code
        } else {
          try {
            const { project, task: t } = await resolveProjectTask(client, taskRef) as {
              project: Project
              task: Task
            }
            kind = 'pinned'; task = t; projectId = project.id
            code = taskCode(t, project.code)
          } catch (projErr) {
            if (parsed) throw projErr
            const q = await resolveQuick()
            kind = 'quick'; task = q.task; code = q.code
          }
        }

        const next = !task.beyondLimit
        const body = kind === 'quick'
          ? { quickTaskIds: [task.id], beyondLimit: next }
          : { pinnedTasks: [{ projectId: projectId!, taskId: task.id }], beyondLimit: next }
        await client.post('/api/v1/today/beyond-limit', body)

        printResult({ ...task, beyondLimit: next }, {
          json: globalOpts.json,
          formatFn: () => {
            const prefix = code !== '-' ? code + ' ' : ''
            return next
              ? `Beyond limit: ${prefix}${task.title}`
              : `Back in limit: ${prefix}${task.title}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })
}
