import type { Command } from 'commander'
import { ApiClient } from '../lib/api-client.js'
import { resolveConfig } from '../lib/config.js'
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
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

      try {
        const parsed = parseTaskCode(taskRef)
        let result: NoteResult

        if (parsed && parsed.projectCode === 'QT') {
          const task = await resolveQuickTask(client, taskRef)
          result = await client.post<NoteResult>(`/api/v1/quick-tasks/${task.id}/note`)
        } else {
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
