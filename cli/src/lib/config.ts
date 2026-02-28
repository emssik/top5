import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface CliConfig {
  apiKey?: string
  port?: number
  host?: string
}

const CONFIG_DIR = join(homedir(), '.config', 'top5')
const CONFIG_FILE = join(CONFIG_DIR, 'cli.json')

const DEFAULTS: Required<CliConfig> = {
  apiKey: '',
  port: 15055,
  host: '127.0.0.1',
}

export function readConfig(): CliConfig {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8')
    return JSON.parse(raw) as CliConfig
  } catch {
    return {}
  }
}

export function writeConfig(config: CliConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export interface ResolvedConfig {
  apiKey: string
  port: number
  host: string
}

/**
 * Resolve config with priority: CLI flags > env vars > config file > defaults
 */
export function resolveConfig(flags: { apiKey?: string; port?: string }): ResolvedConfig {
  const file = readConfig()

  const apiKey =
    flags.apiKey ??
    process.env['TOP5_API_KEY'] ??
    file.apiKey ??
    DEFAULTS.apiKey

  const port =
    (flags.port ? parseInt(flags.port, 10) : undefined) ??
    (process.env['TOP5_API_PORT'] ? parseInt(process.env['TOP5_API_PORT'], 10) : undefined) ??
    file.port ??
    DEFAULTS.port

  const host =
    process.env['TOP5_API_HOST'] ??
    file.host ??
    DEFAULTS.host

  return { apiKey, port, host }
}

export const VALID_CONFIG_KEYS = ['apiKey', 'port', 'host'] as const
export type ConfigKey = (typeof VALID_CONFIG_KEYS)[number]
