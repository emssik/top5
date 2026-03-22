import type { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { printResult, formatTable, die } from '../lib/output.js'

interface TodayTask {
  kind: 'quick' | 'pinned'
  id: string
  title: string
  order: number
  projectName?: string
  projectCode?: string
  taskNumber?: number
  repeatingTaskId?: string | null
  inProgress?: boolean
  dueDate?: string | null
}

function taskCode(t: TodayTask): string {
  if (t.kind === 'pinned' && t.projectCode && t.taskNumber != null) {
    return `${t.projectCode}-${t.taskNumber}`
  }
  if (t.kind === 'quick' && t.taskNumber != null) {
    return `QT-${t.taskNumber}`
  }
  return '-'
}

function taskStatus(t: TodayTask): string {
  if (t.inProgress) return 'in-progress'
  if (t.dueDate) return `due:${t.dueDate}`
  if (t.repeatingTaskId) return 'repeating'
  return ''
}

export function register(program: Command): void {
  program
    .command('today')
    .description('Show today\'s visible tasks (no overflow, no completed)')
    .action(async (_opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const tasks = await client.get<TodayTask[]>('/api/v1/today')

        printResult(tasks, {
          json: globalOpts.json,
          formatFn: () =>
            formatTable(tasks, [
              { header: '#', value: (t) => taskCode(t), align: 'right' },
              { header: 'TITLE', value: (t) => t.title },
              { header: 'PROJECT', value: (t) => t.projectCode ?? '' },
              { header: 'STATUS', value: (t) => taskStatus(t) },
            ]),
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })
}
