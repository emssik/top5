import type { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { resolveProjectTask, resolveQuickTask, parseTaskCode } from '../lib/resolve.js'
import { printResult, die } from '../lib/output.js'

interface NoteResult {
  noteRef: string
  filePath: string
}

interface ProjectSummary {
  id: string
  code?: string
  name: string
  tasks: { id: string; taskNumber?: number; title: string; completed: boolean }[]
}

export function register(program: Command): void {
  program
    .command('note')
    .description('Create/open a task note (e.g. top5 note PRJ-3 or top5 note QT-5)')
    .argument('<task-ref>', 'Task code (e.g. PRJ-3) or QT-5')
    .action(async (taskRef: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const parsed = parseTaskCode(taskRef)
        let result: NoteResult

        if (parsed && parsed.projectCode === 'QT') {
          // QT-N code
          const task = await resolveQuickTask(client, taskRef)
          result = await client.post<NoteResult>(`/api/v1/quick-tasks/${task.id}/note`)
        } else if (!parsed) {
          // Raw ID — try quick task first, fall back to project task only if not found
          let quickTask: { id: string } | null = null
          try {
            quickTask = await resolveQuickTask(client, taskRef)
          } catch {
            // not a quick task — fall through to project task
          }

          if (quickTask) {
            result = await client.post<NoteResult>(`/api/v1/quick-tasks/${quickTask.id}/note`)
          } else {
            const { project, task } = await resolveProjectTask(client, taskRef) as {
              project: ProjectSummary
              task: { id: string; taskNumber?: number; title: string }
            }
            result = await client.post<NoteResult>(`/api/v1/projects/${project.id}/tasks/${task.id}/note`)
          }
        } else {
          // PRJ-N code
          const { project, task } = await resolveProjectTask(client, taskRef) as {
            project: ProjectSummary
            task: { id: string; taskNumber?: number; title: string }
          }
          result = await client.post<NoteResult>(`/api/v1/projects/${project.id}/tasks/${task.id}/note`)
        }

        printResult(result, {
          json: globalOpts.json,
          formatFn: () => result.filePath,
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })
}
