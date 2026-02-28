import type { Command } from 'commander'
import { ApiClient } from '../lib/api-client.js'
import { resolveConfig } from '../lib/config.js'
import { resolveProject, resolveProjectTask } from '../lib/resolve.js'
import { printResult, formatTable, die } from '../lib/output.js'

interface Task {
  id: string
  title: string
  completed: boolean
  taskNumber?: number
  isToDoNext?: boolean
  inProgress?: boolean
  dueDate?: string | null
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
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

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
    .action(async (projectRef: string, title: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

      try {
        // Resolve project first to get full data
        const project = await resolveProject(client, projectRef) as Project

        // Create task with required fields
        const newTask = {
          id: crypto.randomUUID(),
          title,
          completed: false,
          createdAt: new Date().toISOString(),
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

        printResult(savedTask ?? newTask, {
          json: globalOpts.json,
          formatFn: () => {
            const code = savedTask?.taskNumber != null && project.code
              ? `${project.code}-${savedTask.taskNumber}`
              : ''
            return `Created: ${code ? code + ' ' : ''}${title}`
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
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

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
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

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
