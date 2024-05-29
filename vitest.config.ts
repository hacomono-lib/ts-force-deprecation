import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// biome-ignore lint/nursery/noDefaultExport: <explanation>
export default defineConfig({
  test: {
    include: ['test/**/*.{test,spec}.ts'],
    typecheck: {
      include: ['test/**/*.{test,spec}-d.ts'],
    },
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
})
