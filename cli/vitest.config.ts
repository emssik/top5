import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    root: '.',
    include: ['tests/**/*.test.ts'],
    // Vitest 2: minWorkers must not exceed maxWorkers (default min = CPU count)
    maxWorkers: 2,
    minWorkers: 1,
  },
})
