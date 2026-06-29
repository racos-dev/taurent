import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig([
  globalIgnores([
    'dist',
    'src-tauri/target/**/*',
    'src/testing/**/*.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: { tsconfigRootDir },
    },
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@tanstack/react-query-devtools',
              message: 'react-query-devtools must not be imported in the production startup path. It is a heavy bundle and must remain out of the initial render. Use it only in dev tools or explicit debug panels.',
            },
          ],
        },
      ],
    },
  },
])
