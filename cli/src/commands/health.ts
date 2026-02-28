import type { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { printResult, die } from '../lib/output.js'

interface HealthData {
  status: string
  version: string
}

export function register(program: Command): void {
  program
    .command('health')
    .description('Check if top5 API is running')
    .action(async (_opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const data = await client.get<HealthData>('/api/v1/health')
        printResult(data, {
          json: globalOpts.json,
          formatFn: () => `top5 API is running (v${data.version})`,
        })
      } catch (err: unknown) {
        if (globalOpts.json) {
          console.log(JSON.stringify({ ok: false, error: (err as Error).message }))
          process.exit(1)
        }
        die((err as Error).message)
      }
    })
}
