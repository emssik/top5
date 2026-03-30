import type { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { resolveProject, resolveProjectTask } from '../lib/resolve.js'
import { printResult, formatTable, die, warn } from '../lib/output.js'
import { parseDate, formatDueDate } from '../lib/date.js'

interface Task {
  id: string
  title: string
  completed: boolean
  taskNumber?: number
  isToDoNext?: boolean
  inProgress?: boolean
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

  // top5 add <project> <title>
  program
    .command('add')
    .description('Add a task to a project')
    .argument('<project>', 'Project code or ID')
    .argument('<title>', 'Task title')
    .option('-n, --note', 'Create a note for the task')
    .option('-d, --due <date>', 'Due date (YYYY-MM-DD, today, tomorrow, +Nd, mon-sun)')
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

        printResult(savedTask ?? newTask, {
          json: globalOpts.json,
          formatFn: () => {
            let msg = `Created: ${code ? code + ' ' : ''}${title}`
            if (dueDate) msg += ` (due: ${formatDueDate(dueDate)})`
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
}
