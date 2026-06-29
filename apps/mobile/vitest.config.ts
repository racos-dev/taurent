import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@taurent/bridge': path.resolve(__dirname, '../../packages/bridge/src'),
      '@taurent/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@taurent/web-core': path.resolve(__dirname, '../../packages/web-core/src'),
      '@taurent/web-ui': path.resolve(__dirname, '../../packages/web-ui/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
