import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// We need to mock the CONFIG path before importing the module.
// The config module reads from ~/.config/top5/cli.json.
// We'll use dynamic imports and mock the homedir.

let testDir: string

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'top5-cli-test-'))
  // Reset module cache for each test
  vi.resetModules()
})

afterEach(() => {
  if (testDir) {
    rmSync(testDir, { recursive: true, force: true })
  }
  vi.restoreAllMocks()
  delete process.env['TOP5_API_KEY']
  delete process.env['TOP5_API_PORT']
  delete process.env['TOP5_API_HOST']
})

async function importConfig() {
  // Mock homedir to point to our temp dir so config reads from testDir/.config/top5/cli.json
  vi.doMock('node:os', () => ({
    homedir: () => testDir,
  }))
  return import('../src/lib/config')
}

function writeConfigFile(data: Record<string, unknown>) {
  const { mkdirSync, writeFileSync } = require('node:fs')
  const configDir = join(testDir, '.config', 'top5')
  mkdirSync(configDir, { recursive: true })
  writeFileSync(join(configDir, 'cli.json'), JSON.stringify(data, null, 2), 'utf-8')
}

describe('config', () => {
  describe('readConfig', () => {
    it('returns empty object when no config file exists', async () => {
      const { readConfig } = await importConfig()
      expect(readConfig()).toEqual({})
    })

    it('reads config from file', async () => {
      writeConfigFile({ apiKey: 'test-key', port: 9999, host: '10.0.0.1' })
      const { readConfig } = await importConfig()
      const config = readConfig()
      expect(config.apiKey).toBe('test-key')
      expect(config.port).toBe(9999)
      expect(config.host).toBe('10.0.0.1')
    })

    it('handles malformed JSON gracefully', async () => {
      const { mkdirSync, writeFileSync } = require('node:fs')
      const configDir = join(testDir, '.config', 'top5')
      mkdirSync(configDir, { recursive: true })
      writeFileSync(join(configDir, 'cli.json'), 'NOT JSON', 'utf-8')

      const { readConfig } = await importConfig()
      expect(readConfig()).toEqual({})
    })
  })

  describe('writeConfig', () => {
    it('creates config dir and writes file', async () => {
      const { writeConfig, readConfig } = await importConfig()
      writeConfig({ apiKey: 'my-key', port: 12345 })

      const config = readConfig()
      expect(config.apiKey).toBe('my-key')
      expect(config.port).toBe(12345)
    })

    it('writes valid JSON', async () => {
      const { writeConfig } = await importConfig()
      writeConfig({ apiKey: 'abc', host: '0.0.0.0' })

      const raw = readFileSync(join(testDir, '.config', 'top5', 'cli.json'), 'utf-8')
      const parsed = JSON.parse(raw)
      expect(parsed.apiKey).toBe('abc')
      expect(parsed.host).toBe('0.0.0.0')
    })

    it('overwrites existing config', async () => {
      writeConfigFile({ apiKey: 'old-key', port: 1111 })
      const { writeConfig, readConfig } = await importConfig()
      writeConfig({ apiKey: 'new-key', port: 2222 })

      const config = readConfig()
      expect(config.apiKey).toBe('new-key')
      expect(config.port).toBe(2222)
    })
  })

  describe('resolveConfig', () => {
    it('uses defaults when nothing is set', async () => {
      const { resolveConfig } = await importConfig()
      const config = resolveConfig({})
      expect(config.apiKey).toBe('')
      expect(config.port).toBe(15055)
      expect(config.host).toBe('127.0.0.1')
    })

    it('reads from config file', async () => {
      writeConfigFile({ apiKey: 'file-key', port: 9000, host: '10.0.0.1' })
      const { resolveConfig } = await importConfig()
      const config = resolveConfig({})
      expect(config.apiKey).toBe('file-key')
      expect(config.port).toBe(9000)
      expect(config.host).toBe('10.0.0.1')
    })

    it('env vars override config file', async () => {
      writeConfigFile({ apiKey: 'file-key', port: 9000 })
      process.env['TOP5_API_KEY'] = 'env-key'
      process.env['TOP5_API_PORT'] = '7777'

      const { resolveConfig } = await importConfig()
      const config = resolveConfig({})
      expect(config.apiKey).toBe('env-key')
      expect(config.port).toBe(7777)
    })

    it('CLI flags override env vars', async () => {
      process.env['TOP5_API_KEY'] = 'env-key'
      process.env['TOP5_API_PORT'] = '7777'

      const { resolveConfig } = await importConfig()
      const config = resolveConfig({ apiKey: 'flag-key', port: '3333' })
      expect(config.apiKey).toBe('flag-key')
      expect(config.port).toBe(3333)
    })

    it('full priority: CLI flag > env > file > default', async () => {
      writeConfigFile({ apiKey: 'file-key', port: 9000, host: '10.0.0.1' })
      process.env['TOP5_API_KEY'] = 'env-key'
      process.env['TOP5_API_PORT'] = '7777'
      process.env['TOP5_API_HOST'] = '192.168.1.1'

      const { resolveConfig } = await importConfig()
      const config = resolveConfig({ apiKey: 'flag-key', port: '3333' })
      expect(config.apiKey).toBe('flag-key')
      expect(config.port).toBe(3333)
      // host has no CLI flag — env wins
      expect(config.host).toBe('192.168.1.1')
    })

    it('partial config file fills in missing values', async () => {
      writeConfigFile({ apiKey: 'partial-key' })
      const { resolveConfig } = await importConfig()
      const config = resolveConfig({})
      expect(config.apiKey).toBe('partial-key')
      expect(config.port).toBe(15055) // default
      expect(config.host).toBe('127.0.0.1') // default
    })
  })

  describe('VALID_CONFIG_KEYS', () => {
    it('contains expected keys', async () => {
      const { VALID_CONFIG_KEYS } = await importConfig()
      expect(VALID_CONFIG_KEYS).toContain('apiKey')
      expect(VALID_CONFIG_KEYS).toContain('port')
      expect(VALID_CONFIG_KEYS).toContain('host')
    })
  })
})
