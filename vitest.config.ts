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
    include: ['tests/api/**/*.test.ts'],
    globals: true,
    testTimeout: 10000
  }
})
