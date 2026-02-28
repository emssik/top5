import type { Command } from 'commander'
import { ApiClient } from '../lib/api-client.js'
import { resolveConfig } from '../lib/config.js'
import { printResult, formatTable, die } from '../lib/output.js'

interface Project {
  id: string
  name: string
  code?: string
  tasks: { completed: boolean; isToDoNext?: boolean }[]
  archivedAt: string | null
  suspendedAt: string | null
  order: number
}

export function register(program: Command): void {
  program
    .command('projects')
    .description('List projects')
    .option('-a, --all', 'Show all projects (including archived and suspended)')
    .option('--archived', 'Show only archived projects')
    .option('--suspended', 'Show only suspended projects')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
      const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)

      try {
        let projects = await client.get<Project[]>('/api/v1/projects')

        // Filter
        if (opts.archived) {
          projects = projects.filter((p) => p.archivedAt)
        } else if (opts.suspended) {
          projects = projects.filter((p) => p.suspendedAt)
        } else if (!opts.all) {
          projects = projects.filter((p) => !p.archivedAt && !p.suspendedAt)
        }

        // Sort by order
        projects.sort((a, b) => a.order - b.order)

        printResult(projects, {
          json: globalOpts.json,
          formatFn: () =>
            formatTable(projects, [
              { header: 'CODE', value: (p) => p.code ?? '-' },
              { header: 'NAME', value: (p) => p.name },
              {
                header: 'TASKS',
                value: (p) => {
                  const active = p.tasks.filter((t) => !t.completed).length
                  return String(active)
                },
                align: 'right',
              },
              {
                header: 'PINNED',
                value: (p) => {
                  const pinned = p.tasks.filter((t) => t.isToDoNext && !t.completed).length
                  return String(pinned)
                },
                align: 'right',
              },
              {
                header: 'STATUS',
                value: (p) => {
                  if (p.archivedAt) return 'archived'
                  if (p.suspendedAt) return 'suspended'
                  return 'active'
                },
              },
            ]),
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })
}
