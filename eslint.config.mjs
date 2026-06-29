import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import { fileURLToPath } from 'node:url';

import spacingScaleRule from './.eslintrules-spacing-scale.js';
import colorTokensRule from './.eslintrules-color-tokens.js';

const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig([
  globalIgnores([
    '**/coverage/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/target/**',
    '**/*.d.ts',
    'packages/*/postcss.config.js',
    'packages/*/src-tauri/target/**',
    'packages/*/tailwind.config.*',
    'packages/*/vite.config.ts',
    '.opencode/**',
    '.sisyphus/**',
    'apps/desktop/e2e/**',
    'apps/mobile/e2e/**',
  ]),
  {
    files: ['packages/**/*.{ts,tsx}', 'apps/mobile/src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: { tsconfigRootDir },
    },
    plugins: {
      react,
      custom: {
        rules: {
          'spacing-scale': spacingScaleRule,
          'color-tokens': colorTokensRule,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'import/no-unresolved': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'warn',
      'react/self-closing-comp': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-case-declarations': 'off',
      'no-debugger': 'error',
      'no-alert': 'off',
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: 'off',
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
      'react/jsx-no-bind': 'off',
      'react/jsx-key': 'warn',
      'custom/spacing-scale': 'error',
      'custom/color-tokens': 'error',
    },
  },
  // Phase 9: Prevent web-core and web-ui from importing Tauri APIs
  // These packages must remain runtime-agnostic and swappable
  {
    files: ['packages/web-core/**/*.{ts,tsx}', 'packages/web-ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tauri-apps/*', '@tauri-apps/**'],
              message:
                'web-core and web-ui must not import @tauri-apps/* APIs. ' +
                'Use @taurent/bridge for cross-platform bridge access.',
            },
          ],
        },
      ],
    },
  },
]);
