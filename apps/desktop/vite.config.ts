import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync } from 'fs'
import { generateThemeInitScript, generateAccentInitScript, generateThemeBackgroundStyles } from '../../packages/shared/src/theme/background'

function themeInitPlugin() {
  return {
    name: 'theme-init',
    transformIndexHtml(html: string): string {
      const style = `<style>${generateThemeBackgroundStyles()}</style>`
      const themeScript = `<script>${generateThemeInitScript()}</script>`
      const accentScript = `<script>${generateAccentInitScript()}</script>`
      return html.replace('</head>', `    ${style}\n    ${themeScript}\n    ${accentScript}\n  </head>`)
    },
  }
}

const sourcemapEnabled = process.env.VITE_SOURCEMAP === '1'
const appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

async function createAnalyzerPlugins() {
  if (process.env.VITE_ANALYZE !== '1') {
    return []
  }

  const visualizerPackage = 'rollup-plugin-visualizer'
  const { visualizer } = await import(visualizerPackage)

  return [
    visualizer({
      filename: path.resolve(__dirname, '../../artifacts/desktop/bundle/stats.html'),
      template: 'treemap',
      gzipSize: true,
      open: false,
    }),
    visualizer({
      filename: path.resolve(__dirname, '../../artifacts/desktop/bundle/stats.json'),
      template: 'raw-data',
      gzipSize: true,
      open: false,
    }),
  ]
}

export default defineConfig(async () => ({
  plugins: [
    tailwindcss(),
    react(),
    themeInitPlugin(),
    ...await createAnalyzerPlugins(),
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VITE_APP_VERSION ?? appVersion),
    'import.meta.env.VITE_RELEASE_TAG': JSON.stringify(process.env.VITE_RELEASE_TAG ?? ''),
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(process.env.VITE_GIT_SHA ?? ''),
  },
  // Pre-bundle these deps at startup so Vite does not trigger a late-discovery
  // full-page reload when it finds them deep in the module graph after first render.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
  },
  resolve: {
    alias: ((): Array<{ find: string; replacement: string }> => {
      const automationAliases: Array<{ find: string; replacement: string }> = process.env.VITE_AUTOMATION === '1'
        ? [
            // Order matters: more specific path aliases must come before the
            // broader `@taurent/bridge/*` entries that follow so that the
            // mock bridge wins over the production source. Aliases are
            // matched by Vite in declaration order, first match wins.
            //
            // The app imports its desktop bridge from
            // `@taurent/bridge/adapters/desktop` (see
            // apps/desktop/src/connection/QBClientProvider.tsx) — this entry
            // is required so the mock bridge side effect that installs
            // `window.__TAURENT_AUTOMATION__` actually runs.
            { find: '@taurent/bridge/adapters/desktop', replacement: path.resolve(__dirname, './src/testing/mockDesktopBridge.ts') },
            { find: '@taurent/bridge/desktop/notification', replacement: path.resolve(__dirname, './src/testing/mockNativeNotification.ts') },
            { find: '@taurent/bridge/transport/tauri', replacement: path.resolve(__dirname, './src/testing/mockTauriTransport.ts') },
            // `setupTauriLogging` in the real bridge pulls in
            // `@tauri-apps/plugin-log` and the Tauri `isTauri()` probe,
            // neither of which can resolve under the headless Chromium
            // renderer. Swapping in a no-op preserves the required bootstrap
            // order in apps/desktop/src/main.tsx without dragging the
            // Tauri log plugin into the browser runtime.
            { find: '@taurent/bridge/logging', replacement: path.resolve(__dirname, './src/testing/mockTauriLogging.ts') },
            { find: '@tauri-apps/api/core', replacement: path.resolve(__dirname, './src/testing/mockTauriCore.ts') },
            { find: '@tauri-apps/api/event', replacement: path.resolve(__dirname, './src/testing/mockTauriEvent.ts') },
            { find: '@tauri-apps/api/webview', replacement: path.resolve(__dirname, './src/testing/mockTauriWebview.ts') },
            { find: '@tauri-apps/api/window', replacement: path.resolve(__dirname, './src/testing/mockTauriWindow.ts') },
            { find: '@tauri-apps/api/dpi', replacement: path.resolve(__dirname, './src/testing/mockTauriDpi.ts') },
            { find: '@tauri-apps/api/webviewWindow', replacement: path.resolve(__dirname, './src/testing/mockTauriWebviewWindow.ts') },
            { find: '@tauri-apps/plugin-autostart', replacement: path.resolve(__dirname, './src/testing/mockTauriPluginAutostart.ts') },
            { find: '@tauri-apps/plugin-clipboard-manager', replacement: path.resolve(__dirname, './src/testing/mockTauriPluginClipboard.ts') },
            { find: '@tauri-apps/plugin-dialog', replacement: path.resolve(__dirname, './src/testing/mockTauriPluginDialog.ts') },
            { find: '@tauri-apps/plugin-store', replacement: path.resolve(__dirname, './src/testing/mockTauriPluginStore.ts') },
            { find: '@tauri-apps/plugin-window-state', replacement: path.resolve(__dirname, './src/testing/mockTauriWindowState.ts') },
          ]
        : [];
      return [
        ...automationAliases,
        { find: '@', replacement: path.resolve(__dirname, './src') },
        { find: '@taurent/bridge', replacement: path.resolve(__dirname, '../../packages/bridge/src') },
        { find: '@taurent/shared', replacement: path.resolve(__dirname, '../../packages/shared/src') },
        { find: '@taurent/web-core', replacement: path.resolve(__dirname, '../../packages/web-core/src') },
        { find: '@taurent/web-ui', replacement: path.resolve(__dirname, '../../packages/web-ui/src') },
      ];
    })(),
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    sourcemap: sourcemapEnabled,
    rollupOptions: {
      input: {
        main: './index.html',
        settings: './src/settings-index.html',
      },
      output: {
        manualChunks: (id: string) => {
          // Split aliased workspace packages resolved to source paths before node_modules
          const pkg = '/packages/';
          if (id.includes(pkg)) {
            if (id.includes('/packages/shared/src')) return 'shared';
            if (id.includes('/packages/bridge/src')) return 'bridge';
            if (id.includes('/packages/web-core/src')) return 'web-core';
            if (id.includes('/packages/web-ui/src')) return 'web-ui';
          }
          if (id.includes('node_modules')) {
            if (id.includes('@tanstack')) return 'tanstack';
            if (id.includes('react-router')) return 'router';
            if (id.includes('zustand')) return 'zustand';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('@dnd-kit')) return 'dnd';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('@tauri-apps')) return 'tauri';
            return 'vendor';
          }
        },
      },
    },
  },
}))
