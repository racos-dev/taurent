import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';

const desktopCoverageLane = process.argv.includes('--browser') ? 'browser' : 'unit';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@taurent/bridge': path.resolve(__dirname, '../../packages/bridge/src'),
      '@taurent/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@taurent/web-core': path.resolve(__dirname, '../../packages/web-core/src'),
      '@taurent/web-ui': path.resolve(__dirname, '../../packages/web-ui/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    browser: {
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: path.resolve(__dirname, `../../artifacts/coverage/desktop/${desktopCoverageLane}`),
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.d.ts'],
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
