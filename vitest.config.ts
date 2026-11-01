import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      electron: resolve(__dirname, 'tests/api/__mocks__/electron.ts'),
      '@electron-toolkit/utils': resolve(__dirname, 'tests/api/__mocks__/electron-toolkit-utils.ts')
    }
  },
  test: {
    include: ['tests/api/**/*.test.ts', 'tests/main/**/*.test.ts'],
    globals: true,
    testTimeout: 10000,
    // max 2 workers: concurrent runs (gate, verifier, mutants) saturated the CPU
    maxWorkers: 2
  }
})
