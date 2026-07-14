import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';

const isBrowserRun = process.argv.some((arg) => arg === '--browser' || arg.startsWith('--browser='));
const testIncludes = isBrowserRun
  ? ['src/**/*.test.ts', 'src/**/*.test.tsx']
  : ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'];

export default defineProject({
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
    include: testIncludes,
  },
});
