import sharedPreset from '../../packages/shared/tailwind.preset.mts';

/** @type {import('tailwindcss').Config} */
export default {
  ...sharedPreset,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    '../../packages/web-ui/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/shared/src/**/*.{js,ts,jsx,tsx}',
  ],
  plugins: [],
}
