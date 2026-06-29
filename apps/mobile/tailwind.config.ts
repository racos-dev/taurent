import type { Config } from 'tailwindcss'
import sharedPreset from '../../packages/shared/tailwind.preset.mts'

export default {
  ...sharedPreset,
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/web-ui/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/shared/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    ...sharedPreset.theme,
    extend: {
      ...sharedPreset.theme?.extend,
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
