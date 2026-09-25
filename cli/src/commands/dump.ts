import type { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { CliApiError } from '../lib/api-client.js'
import { printResult, die } from '../lib/output.js'

interface DumpState {
  text: string
  mtime: number | null
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf-8')
}

export function register(program: Command): void {
  program
    .command('dump')
    .description('Show the "Zrzut" text (dump.md) — raw text on stdout, --json for {text, mtime}')
    .option('--set', 'Replace the whole text with stdin (pass --base-mtime to guard against concurrent edits)')
    .option('--base-mtime <ms>', 'With --set: mtime you read earlier (strict protection; default = current mtime right before saving)')
    .option('--append <line>', 'Append a line to the end of the open list (adds "- " if missing)')
    .addHelpText('after', `
Examples:
  top5 dump > dump.md                                  # read raw text
  top5 dump --json                                     # {"text": "...", "mtime": 1727251234567}
  cat clean.md | top5 dump --set                       # overwrite (checks mtime right before saving)
  cat clean.md | top5 dump --set --base-mtime 1727251234567
                                                       # overwrite only if nobody changed the file since that read
  top5 dump --append "zadzwonić do księgowej"          # add one open line

Conflict: if the file changed in the meantime the API returns 409 and nothing is saved — re-read and retry.`)
    .action(async (opts: { set?: boolean; baseMtime?: string; append?: string }, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      if (opts.append !== undefined && opts.set) die('--append and --set can\'t be combined.')

      try {
        if (opts.append !== undefined) {
          const result = await client.post<DumpState>('/api/v1/dump/append', { line: opts.append })
          printResult(result, { json: globalOpts.json, formatFn: () => 'Appended.' })
          return
        }

        if (opts.set) {
          if (process.stdin.isTTY) die('--set reads the new text from stdin (e.g. cat file.md | top5 dump --set).')
          let baseMtime: number | null
          if (opts.baseMtime !== undefined) {
            baseMtime = opts.baseMtime === 'null' ? null : Number(opts.baseMtime)
            if (baseMtime !== null && !Number.isFinite(baseMtime)) die('--base-mtime must be a number (ms) or "null".')
          } else {
            baseMtime = (await client.get<DumpState>('/api/v1/dump')).mtime
          }
          const text = await readStdin()
          // Non-TTY empty stdin (agent shells, an unset $VAR piped in) would wipe the whole dump.
          if (text.trim() === '') die('stdin is empty — refusing to replace the dump with nothing.')
          const result = await client.put<DumpState>('/api/v1/dump', { text, baseMtime })
          printResult({ mtime: result.mtime }, { json: globalOpts.json, formatFn: () => `Saved (mtime ${result.mtime}).` })
          return
        }

        const dump = await client.get<DumpState>('/api/v1/dump')
        if (globalOpts.json) printResult(dump, { json: true })
        else process.stdout.write(dump.text)
      } catch (err: unknown) {
        if (err instanceof CliApiError && err.status === 409) {
          die('Conflict — dump.md changed since it was read. Nothing was saved; run `top5 dump` again and retry.')
        }
        die((err as Error).message)
      }
    })
}
