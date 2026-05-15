import type { Command } from 'commander'
import { createInterface } from 'node:readline/promises'
import { createClient } from '../lib/client.js'
import { resolveProject, resolveProjectTask, resolveQuickTask, parseTaskCode } from '../lib/resolve.js'
import { printResult, formatTable, die, warn } from '../lib/output.js'
import { parseDate, formatDueDate } from '../lib/date.js'

type CycleRole = 'must' | 'should' | 'could'

interface Task {
  id: string
  title: string
  completed: boolean
  taskNumber?: number
  isToDoNext?: boolean
  inProgress?: boolean
  beyondLimit?: boolean
  important?: boolean
  dueDate?: string | null
  cycleRole?: CycleRole
  parentCode?: string | null
  noteRef?: string
}

const CYCLE_ROLES: ReadonlyArray<CycleRole> = ['must', 'should', 'could']

function parseCycleRole(input: string): CycleRole | null {
  const normalized = input.toLowerCase()
  if (normalized === 'none' || normalized === 'null' || normalized === 'clear') return null
  if (CYCLE_ROLES.includes(normalized as CycleRole)) return normalized as CycleRole
  throw new Error(`Invalid cycle role "${input}". Use one of: must, should, could, none`)
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

        const enriched = tasks.map((t) => {
          const code = (t.taskNumber != null && project.code) ? `${project.code}-${t.taskNumber}` : null
          return code ? { ...t, taskCode: code } : { ...t }
        })

        printResult(enriched, {
          json: globalOpts.json,
          formatFn: () => {
            const header = `${project.code ?? project.id} - ${project.name}`
            const table = formatTable(enriched, [
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
            lines.push(`Cycle:    ${task.cycleRole ?? '(none)'}`)
            if (task.parentCode) lines.push(`Parent:   ${task.parentCode}`)
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
    .option('-r, --cycle-role <role>', '12WY cycle role: must, should, could (or none to omit)')
    .option('--parent <code>', '12WY anchor task code in same project (e.g. TOP-42) to attach this as a sub-task')
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

        let cycleRole: CycleRole | undefined
        if (opts.cycleRole) {
          const parsed = parseCycleRole(opts.cycleRole)
          if (parsed === null) die('Cannot set cycle-role to none on a new task. Just omit --cycle-role.')
          cycleRole = parsed
        }

        const project = await resolveProject(client, projectRef) as Project

        let savedTask: Task
        if (opts.parent) {
          if (cycleRole) die('--parent and --cycle-role are mutually exclusive: 12WY sub-tasks inherit priority from the anchor.')
          const raw = String(opts.parent).trim()
          if (!project.code) die(`Project ${project.name} has no code — cannot resolve --parent.`)
          const expected = raw.includes('-') ? raw : `${project.code}-${raw}`
          const anchor = project.tasks.find((t) => !t.completed
            && t.taskNumber != null
            && `${project.code}-${t.taskNumber}` === expected)
          if (!anchor) die(`No active task ${expected} found in project ${project.code}.`)
          if (!anchor.cycleRole) die(`Task ${expected} has no cycleRole — only 12WY anchors can be parents.`)

          savedTask = await client.post<Task>(
            `/api/v1/projects/${project.id}/tasks/${anchor.id}/sub-tasks`,
            {
              title,
              ...(dueDate ? { dueDate } : {}),
            }
          )
        } else {
          const newTask = {
            id: crypto.randomUUID(),
            title,
            completed: false,
            createdAt: new Date().toISOString(),
            ...(dueDate ? { dueDate } : {}),
            ...(cycleRole ? { cycleRole } : {}),
          }

          const updatedProject = {
            ...project,
            tasks: [...project.tasks, newTask],
          }

          const result = await client.put<Project[]>(`/api/v1/projects/${project.id}`, updatedProject)
          const found = result.find((p) => p.id === project.id)?.tasks.find((t) => t.id === newTask.id)
          if (!found) die(`Task ${newTask.id} disappeared from PUT response — server bug?`)
          savedTask = found
        }

        const code = savedTask.taskNumber != null && project.code
          ? `${project.code}-${savedTask.taskNumber}`
          : ''

        let pinned = false
        if (opts.pin) {
          try {
            await client.post(`/api/v1/projects/${project.id}/tasks/${savedTask.id}/toggle-to-do-next`)
            pinned = true
          } catch (e: unknown) {
            warn(`Pin failed: ${(e as Error).message}`)
          }
        }

        let notePath: string | undefined
        if (opts.note) {
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
          ...savedTask,
          ...(notePath ? { notePath } : {}),
          ...(pinned ? { pinned } : {}),
        }

        printResult(resultData, {
          json: globalOpts.json,
          formatFn: () => {
            let msg = `Created: ${code ? code + ' ' : ''}${title}`
            if (dueDate) msg += ` (due: ${formatDueDate(dueDate)})`
            if (cycleRole) msg += ` [${cycleRole}]`
            if (savedTask.parentCode) msg += ` [parent: ${savedTask.parentCode}]`
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

  // top5 cycle-role <task-code> <role>
  program
    .command('cycle-role')
    .description('Set or clear the 12WY cycle role on a project task')
    .argument('<task-code>', 'Task code (e.g. PRJ-3) or task ID')
    .argument('<role>', 'Cycle role: must, should, could, or none')
    .action(async (taskRef: string, roleInput: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const cycleRole = parseCycleRole(roleInput)
        const { project, task } = await resolveProjectTask(client, taskRef) as {
          project: Project
          task: Task
        }

        await client.put(`/api/v1/projects/${project.id}/tasks/${task.id}/cycle-role`, { cycleRole })

        const nextTask = { ...task, cycleRole: cycleRole ?? undefined }
        printResult(nextTask, {
          json: globalOpts.json,
          formatFn: () => {
            const code = taskCode(task, project.code)
            const prefix = code !== '-' ? code + ' ' : ''
            if (cycleRole === null) return `${prefix}${task.title} — cycle role cleared`
            return `${prefix}${task.title} — cycle role: ${cycleRole}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  type CycleStatusFilter = 'active' | 'done' | 'all'
  const CYCLE_STATUS_FILTERS: ReadonlyArray<CycleStatusFilter> = ['active', 'done', 'all']

  interface CycleSubTaskItem {
    id: string
    taskNumber: number | null
    taskCode: string
    title: string
    status: 'done' | 'in-progress' | 'up-next' | 'active'
    due: string | null
    important: boolean
    completed: boolean
  }

  interface CycleTaskItem {
    id: string
    taskNumber: number | null
    taskCode: string
    title: string
    projectId: string
    projectCode: string | null
    projectName: string
    cycleRole: CycleRole
    status: 'done' | 'in-progress' | 'up-next' | 'active'
    due: string | null
    important: boolean
    beyondLimit: boolean
    completed: boolean
    children?: CycleSubTaskItem[]
  }

  type CycleListOpts = { layer?: string; status?: string; tree?: boolean; withChildren?: boolean }

  const ROLE_HEADERS: Record<CycleRole, string> = { must: 'MUST', should: 'SHOULD', could: 'COULD' }

  function formatCycleList(items: CycleTaskItem[], filterLayer: CycleRole | null, tree: boolean): string {
    const layers: ReadonlyArray<CycleRole> = filterLayer ? [filterLayer] : CYCLE_ROLES
    const buckets: Record<CycleRole, CycleTaskItem[]> = { must: [], should: [], could: [] }
    const counts: Record<CycleRole, { active: number; done: number; childActive: number; childDone: number }> = {
      must: { active: 0, done: 0, childActive: 0, childDone: 0 },
      should: { active: 0, done: 0, childActive: 0, childDone: 0 },
      could: { active: 0, done: 0, childActive: 0, childDone: 0 }
    }
    for (const item of items) {
      buckets[item.cycleRole].push(item)
      counts[item.cycleRole][item.completed ? 'done' : 'active']++
      for (const child of item.children ?? []) {
        counts[item.cycleRole][child.completed ? 'childDone' : 'childActive']++
      }
    }
    return layers.map((layer) => {
      const { active, done, childActive, childDone } = counts[layer]
      const childSuffix = tree && (childActive + childDone > 0)
        ? `, ${childActive} sub active, ${childDone} sub done`
        : ''
      const header = `${ROLE_HEADERS[layer]} (${active} active, ${done} done${childSuffix})`
      if (!tree) {
        const table = formatTable(buckets[layer], [
          { header: '#', value: (t) => t.taskCode || '-', align: 'right' },
          { header: 'TITLE', value: (t) => t.title },
          { header: 'PROJECT', value: (t) => t.projectCode ?? t.projectName },
          { header: 'STATUS', value: (t) => t.status },
          { header: 'DUE', value: (t) => formatDueDate(t.due) }
        ])
        return `${header}\n${table}`
      }
      // Tree: anchor on its own line, children indented underneath.
      const lines: string[] = [header]
      for (const anchor of buckets[layer]) {
        const anchorCode = anchor.taskCode || '-'
        const anchorDue = anchor.due ? `  ${formatDueDate(anchor.due)}` : ''
        const anchorStatus = anchor.status !== 'active' ? `  [${anchor.status}]` : ''
        const anchorProject = anchor.projectCode ?? anchor.projectName
        lines.push(`  ${anchorCode}  ${anchor.title}  (${anchorProject})${anchorStatus}${anchorDue}`)
        for (const child of anchor.children ?? []) {
          const childCode = child.taskCode || '-'
          const childDue = child.due ? `  ${formatDueDate(child.due)}` : ''
          const childStatus = child.completed ? '  [done]' : (child.status !== 'active' ? `  [${child.status}]` : '')
          lines.push(`      └ ${childCode}  ${child.title}${childStatus}${childDue}`)
        }
      }
      return lines.join('\n')
    }).join('\n\n')
  }

  async function runCycleList(opts: CycleListOpts, cmd: import('commander').Command): Promise<void> {
    const globalOpts = cmd.optsWithGlobals()
    const client = createClient(globalOpts)

    let layer: CycleRole | null = null
    if (opts.layer) {
      const normalized = opts.layer.toLowerCase() as CycleRole
      if (!CYCLE_ROLES.includes(normalized)) die('Invalid --layer. Use must, should, or could.')
      layer = normalized
    }

    const status = (opts.status ?? 'active') as CycleStatusFilter
    if (!CYCLE_STATUS_FILTERS.includes(status)) {
      die('Invalid --status. Use active, done, or all.')
    }

    const tree = !!(opts.tree || opts.withChildren)

    const params = new URLSearchParams()
    if (layer) params.set('layer', layer)
    params.set('status', status)
    if (tree) params.set('tree', '1')
    const path = `/api/v1/cycle/tasks?${params.toString()}`

    try {
      const items = await client.get<CycleTaskItem[]>(path)
      printResult(items, {
        json: globalOpts.json,
        formatFn: () => formatCycleList(items, layer, tree)
      })
    } catch (err: unknown) {
      die((err as Error).message)
    }
  }

  program
    .command('12w')
    .description('List 12WY cycle tasks (tasks with cycleRole set), grouped by MoSCoW layer')
    .option('-l, --layer <role>', 'Filter to one layer: must, should, or could')
    .option('-s, --status <status>', 'Filter by status: active (default), done, or all')
    .option('-t, --tree', 'Render anchors with their sub-tasks (parentCode children)')
    .option('--with-children', 'Alias for --tree')
    .action(runCycleList)

  // top5 cycle reset
  const cycleCmd = program
    .command('cycle')
    .description('12WY cycle operations')

  cycleCmd
    .command('list')
    .description('List 12WY cycle tasks (alias for `top5 12w`)')
    .option('-l, --layer <role>', 'Filter to one layer: must, should, or could')
    .option('-s, --status <status>', 'Filter by status: active (default), done, or all')
    .option('-t, --tree', 'Render anchors with their sub-tasks (parentCode children)')
    .option('--with-children', 'Alias for --tree')
    .action(runCycleList)

  cycleCmd
    .command('reset')
    .description('Clear cycleRole on all tasks (end-of-cycle reset)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-l, --layer <role>', 'Reset only one layer: must, should, or could')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      let layer: CycleRole | null = null
      if (opts.layer) {
        const parsed = parseCycleRole(opts.layer)
        if (parsed === null) die('Invalid --layer. Use must, should, or could.')
        layer = parsed
      }

      if (!opts.yes) {
        if (!process.stdin.isTTY) {
          die('Refusing to reset without --yes (no interactive terminal).')
        }
        const scope = layer ? `layer "${layer}"` : 'ALL layers'
        const rl = createInterface({ input: process.stdin, output: process.stderr })
        let answer = ''
        try {
          answer = await rl.question(`Reset cycleRole on ${scope}? Type "yes" to confirm: `)
        } finally {
          rl.close()
        }
        if (answer.trim().toLowerCase() !== 'yes') die('Aborted.')
      }

      try {
        const result = await client.post<{ cleared: number }>(
          '/api/v1/cycle/reset',
          layer ? { layer } : {}
        )
        printResult(result, {
          json: globalOpts.json,
          formatFn: () => `Cleared cycleRole on ${result.cleared} task${result.cleared === 1 ? '' : 's'}${layer ? ` (layer: ${layer})` : ''}.`,
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

  // top5 important <task-code>
  program
    .command('important')
    .description('Toggle the Important star on a task (visible on Today, Focus, Clean view)')
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

        let next: boolean
        if (kind === 'quick') {
          const quickTasks = await client.post<Task[]>(`/api/v1/quick-tasks/${task.id}/toggle-important`)
          const updated = quickTasks.find((t) => t.id === task.id)
          next = !!updated?.important
        } else {
          const projects = await client.post<Project[]>(`/api/v1/projects/${projectId}/tasks/${task.id}/toggle-important`)
          const updated = projects.find((p) => p.id === projectId)?.tasks.find((t) => t.id === task.id)
          next = !!updated?.important
        }

        printResult({ ...task, important: next }, {
          json: globalOpts.json,
          formatFn: () => {
            const prefix = code !== '-' ? code + ' ' : ''
            return next
              ? `★ Important: ${prefix}${task.title}`
              : `Unmarked: ${prefix}${task.title}`
          },
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })
}
