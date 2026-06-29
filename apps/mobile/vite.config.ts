import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync } from 'fs'
import { generateThemeInitScript, generateAccentInitScript, generateThemeBackgroundStyles } from '../../packages/shared/src/theme/background'

// Mobile detection for HMR
const mobile = !!/android|ios/.exec(process.env.TAURI_ENV_PLATFORM ?? '')
const host = process.env.TAURI_DEV_HOST
const appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

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

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    themeInitPlugin(),
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VITE_APP_VERSION ?? appVersion),
    'import.meta.env.VITE_RELEASE_TAG': JSON.stringify(process.env.VITE_RELEASE_TAG ?? ''),
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(process.env.VITE_GIT_SHA ?? ''),
  },
  resolve: {
    alias: ((): Array<{ find: string; replacement: string }> => {
      const automationAliases: Array<{ find: string; replacement: string }> = process.env.VITE_AUTOMATION === '1'
        ? [
            { find: '@taurent/bridge/adapters/mobile-tauri', replacement: path.resolve(__dirname, './src/testing/mockMobileBridge.ts') },
            { find: '@taurent/bridge/transport/tauri', replacement: path.resolve(__dirname, './src/testing/mockTauriTransport.ts') },
            { find: '@taurent/bridge/logging', replacement: path.resolve(__dirname, './src/testing/mockTauriLogging.ts') },
            { find: '@tauri-apps/plugin-dialog', replacement: path.resolve(__dirname, './src/testing/mockTauriPluginDialog.ts') },
            { find: '@tauri-apps/plugin-store', replacement: path.resolve(__dirname, './src/testing/mockTauriPluginStore.ts') },
          ]
        : [];
      return [
        ...automationAliases,
        { find: '@taurent/bridge', replacement: path.resolve(__dirname, '../../packages/bridge/src') },
        { find: '@taurent/shared', replacement: path.resolve(__dirname, '../../packages/shared/src') },
        { find: '@taurent/web-core', replacement: path.resolve(__dirname, '../../packages/web-core/src') },
        { find: '@taurent/web-ui', replacement: path.resolve(__dirname, '../../packages/web-ui/src') },
      ];
    })(),
  },
  server: {
    host: host || (mobile ? '0.0.0.0' : false),
    port: 1420,
    strictPort: true,
    hmr: host
      ? {
          protocol: 'ws',
          host: host,
          port: 1430,
        }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    sourcemap: true,
  },
  clearScreen: false,
})
