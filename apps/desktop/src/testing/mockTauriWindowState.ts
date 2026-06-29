export const StateFlags = {
  POSITION: 1,
  SIZE: 2,
  MAXIMIZED: 4,
} as const;

export async function restoreStateCurrent(_flags: number) {}
