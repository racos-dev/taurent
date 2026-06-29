import type { Config } from 'tailwindcss';
import { tailwindColorTokens } from './src/theme/tokens';

const preset: Config = {
  theme: {
    extend: {
      colors: tailwindColorTokens,
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
      },
    },
  },
};

export default preset;
