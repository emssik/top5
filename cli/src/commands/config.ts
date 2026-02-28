import type { Command } from 'commander'
import { readConfig, writeConfig, resolveConfig, VALID_CONFIG_KEYS, type ConfigKey } from '../lib/config.js'
import { printResult, die } from '../lib/output.js'

export function register(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Show or update CLI configuration')
    .action((_opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const resolved = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })

      if (globalOpts.json) {
        // Mask apiKey in JSON output too
        const masked = {
          ...resolved,
          apiKey: maskKey(resolved.apiKey),
        }
        console.log(JSON.stringify(masked, null, 2))
        return
      }

      console.log(`  host:    ${resolved.host}`)
      console.log(`  port:    ${resolved.port}`)
      console.log(`  apiKey:  ${maskKey(resolved.apiKey)}`)
    })

  configCmd
    .command('set')
    .description('Set a config value')
    .argument('<key>', `Config key (${VALID_CONFIG_KEYS.join(', ')})`)
    .argument('<value>', 'Config value')
    .action((key: string, value: string) => {
      if (!VALID_CONFIG_KEYS.includes(key as ConfigKey)) {
        die(`Invalid config key: ${key}. Valid keys: ${VALID_CONFIG_KEYS.join(', ')}`)
      }

      const config = readConfig()
      if (key === 'port') {
        const port = parseInt(value, 10)
        if (isNaN(port) || port < 1 || port > 65535) {
          die('Port must be a number between 1 and 65535')
        }
        config.port = port
      } else {
        (config as Record<string, unknown>)[key] = value
      }

      writeConfig(config)
      console.log(`  ${key} = ${key === 'apiKey' ? maskKey(value) : value}`)
    })
}

function maskKey(key: string): string {
  if (!key) return '(not set)'
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '...' + key.slice(-4)
}
